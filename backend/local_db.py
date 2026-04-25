import asyncio
import copy
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4


def _json_default(value: Any):
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"No serializable: {type(value)!r}")


def _normalize(value: Any):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _normalize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize(v) for v in value]
    return value


def _get_nested(document: Dict[str, Any], key: str):
    current = document
    for part in key.split('.'):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _set_nested(document: Dict[str, Any], key: str, value: Any):
    parts = key.split('.')
    current = document
    for part in parts[:-1]:
        if part not in current or not isinstance(current[part], dict):
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def _matches_filter(document: Dict[str, Any], query: Dict[str, Any]) -> bool:
    if not query:
        return True

    for key, expected in query.items():
        actual = _get_nested(document, key)
        if isinstance(expected, dict):
            if '$in' in expected:
                values = expected.get('$in') or []
                if actual not in values:
                    return False
            else:
                if actual != expected:
                    return False
        else:
            if actual != expected:
                return False
    return True


def _project(document: Dict[str, Any], projection: Optional[Dict[str, int]]) -> Dict[str, Any]:
    if not projection:
        return copy.deepcopy(document)

    include_keys = [k for k, v in projection.items() if v]
    exclude_keys = [k for k, v in projection.items() if not v]

    if include_keys:
        output = {}
        for key in include_keys:
            value = _get_nested(document, key)
            if value is not None:
                _set_nested(output, key, copy.deepcopy(value))
        if projection.get('_id', 1) and '_id' in document:
            output['_id'] = document['_id']
        return output

    output = copy.deepcopy(document)
    for key in exclude_keys:
        if key == '_id':
            output.pop('_id', None)
            continue
        parts = key.split('.')
        cur = output
        for part in parts[:-1]:
            nxt = cur.get(part)
            if not isinstance(nxt, dict):
                cur = None
                break
            cur = nxt
        if isinstance(cur, dict):
            cur.pop(parts[-1], None)
    return output


@dataclass
class InsertOneResult:
    inserted_id: str


@dataclass
class UpdateResult:
    matched_count: int
    modified_count: int
    upserted_id: Optional[str] = None


@dataclass
class DeleteResult:
    deleted_count: int


class LocalCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.docs = docs

    def sort(self, field: str, direction: int):
        reverse = direction < 0
        self.docs.sort(key=lambda doc: _get_nested(doc, field) or "", reverse=reverse)
        return self

    async def to_list(self, limit: int):
        return copy.deepcopy(self.docs[:limit])


class LocalCollection:
    def __init__(self, db: 'LocalJsonDatabase', name: str):
        self.db = db
        self.name = name

    async def find_one(self, query: Dict[str, Any], projection: Optional[Dict[str, int]] = None, sort: Optional[List[Any]] = None):
        docs = await self._filtered_docs(query)
        if sort:
            field, direction = sort[0]
            docs.sort(key=lambda doc: _get_nested(doc, field) or "", reverse=direction < 0)
        if not docs:
            return None
        return _project(docs[0], projection)

    async def insert_one(self, document: Dict[str, Any]):
        doc = _normalize(copy.deepcopy(document))
        doc.setdefault('_id', uuid4().hex)
        async with self.db.lock:
            self.db.data.setdefault(self.name, []).append(doc)
            await self.db._save()
        return InsertOneResult(inserted_id=doc['_id'])

    def find(self, query: Dict[str, Any], projection: Optional[Dict[str, int]] = None):
        docs = []
        for doc in self.db.data.get(self.name, []):
            if _matches_filter(doc, query):
                docs.append(_project(doc, projection))
        return LocalCursor(docs)

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False):
        set_updates = _normalize(update.get('$set', {}))
        set_on_insert = _normalize(update.get('$setOnInsert', {}))

        async with self.db.lock:
            docs = self.db.data.setdefault(self.name, [])
            for doc in docs:
                if _matches_filter(doc, query):
                    for key, value in set_updates.items():
                        _set_nested(doc, key, value)
                    await self.db._save()
                    return UpdateResult(matched_count=1, modified_count=1)

            if not upsert:
                return UpdateResult(matched_count=0, modified_count=0)

            new_doc = {'_id': uuid4().hex}
            for key, value in query.items():
                if not isinstance(value, dict):
                    _set_nested(new_doc, key, _normalize(value))
            for key, value in set_on_insert.items():
                _set_nested(new_doc, key, value)
            for key, value in set_updates.items():
                _set_nested(new_doc, key, value)
            docs.append(new_doc)
            await self.db._save()
            return UpdateResult(matched_count=0, modified_count=0, upserted_id=new_doc['_id'])

    async def delete_one(self, query: Dict[str, Any]):
        async with self.db.lock:
            docs = self.db.data.setdefault(self.name, [])
            for idx, doc in enumerate(docs):
                if _matches_filter(doc, query):
                    docs.pop(idx)
                    await self.db._save()
                    return DeleteResult(deleted_count=1)
        return DeleteResult(deleted_count=0)

    async def count_documents(self, query: Dict[str, Any]):
        return len(await self._filtered_docs(query))

    async def create_index(self, *_args, **_kwargs):
        return None

    async def _filtered_docs(self, query: Dict[str, Any]):
        return [copy.deepcopy(doc) for doc in self.db.data.get(self.name, []) if _matches_filter(doc, query)]


class LocalJsonDatabase:
    def __init__(self, db_file: Path):
        self.db_file = Path(db_file)
        self.db_file.parent.mkdir(parents=True, exist_ok=True)
        self.lock = asyncio.Lock()
        if self.db_file.exists():
            self.data = json.loads(self.db_file.read_text(encoding='utf-8') or '{}')
        else:
            self.data = {}
            self.db_file.write_text('{}', encoding='utf-8')

    def __getattr__(self, collection_name: str):
        if collection_name.startswith('__'):
            raise AttributeError(collection_name)
        self.data.setdefault(collection_name, [])
        return LocalCollection(self, collection_name)

    async def _save(self):
        self.db_file.write_text(json.dumps(self.data, ensure_ascii=False, indent=2, default=_json_default), encoding='utf-8')
