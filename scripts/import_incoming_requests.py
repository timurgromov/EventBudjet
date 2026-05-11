#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import urllib.request
from dataclasses import dataclass
from datetime import date


RU_MONTHS = {
    'янв': 1,
    'январ': 1,
    'фев': 2,
    'феврал': 2,
    'мар': 3,
    'март': 3,
    'апр': 4,
    'апрел': 4,
    'мая': 5,
    'май': 5,
    'июн': 6,
    'июн': 6,
    'июл': 7,
    'июл': 7,
    'авг': 8,
    'август': 8,
    'сен': 9,
    'сент': 9,
    'сентябр': 9,
    'окт': 10,
    'октябр': 10,
    'ноя': 11,
    'ноябр': 11,
    'дек': 12,
    'декабр': 12,
}


@dataclass(frozen=True)
class ImportRow:
    source: str
    event_date: date | None
    event_date_raw: str | None
    comment: str
    status: str


def compact(value: str | None) -> str:
    return re.sub(r'\s+', ' ', (value or '').replace('\u202c', '').replace('\xa0', ' ')).strip()


def read_csv(args: argparse.Namespace) -> str:
    if args.csv_path:
        with open(args.csv_path, encoding='utf-8-sig') as handle:
            return handle.read()
    if args.csv_url:
        with urllib.request.urlopen(args.csv_url, timeout=args.timeout) as response:
            return response.read().decode('utf-8-sig')
    return sys.stdin.read()


def parse_year(raw_year: str | None, default_year: int) -> int:
    if not raw_year:
        return default_year
    year = int(raw_year)
    return 2000 + year if year < 100 else year


def parse_event_date(raw: str, default_year: int) -> tuple[date | None, str | None]:
    value = compact(raw).lower().replace(',', '.')
    if not value or '?' in value:
        return None, compact(raw) or None
    if '-' in value or '/' in value:
        return None, compact(raw) or None

    numeric = re.fullmatch(r'(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\.?', value)
    if numeric:
        day = int(numeric.group(1))
        month = int(numeric.group(2))
        year = parse_year(numeric.group(3), default_year)
        try:
            return date(year, month, day), None
        except ValueError:
            return None, compact(raw) or None

    text_month = re.fullmatch(r'(\d{1,2})\s+([а-яё.]+)(?:\s+(\d{2,4}))?\.?', value)
    if text_month:
        day = int(text_month.group(1))
        month_name = text_month.group(2).replace('.', '')
        month = next((num for prefix, num in RU_MONTHS.items() if month_name.startswith(prefix)), None)
        year = parse_year(text_month.group(3), default_year)
        if month is not None:
            try:
                return date(year, month, day), None
            except ValueError:
                return None, compact(raw) or None

    return None, compact(raw) or None


def infer_status(source: str, category: str, comment: str) -> str:
    text = f'{source} {category} {comment}'.lower()
    rejected_markers = (
        'отказ',
        'выбрали другого',
        'выбрали друг',
        'я занят',
        'уже занят',
        'не будем',
        'не надо',
        'без ведущего',
        'отменил',
        'отмена',
    )
    signed_markers = (
        'подписали договор',
        'подписали логовор',
        'договор подпис',
    )
    if any(marker in text for marker in rejected_markers):
        return 'rejected'
    if any(marker in text for marker in signed_markers):
        return 'signed'
    return 'in_work'


def build_rows(csv_text: str, default_year: int) -> list[ImportRow]:
    parsed = csv.reader(io.StringIO(csv_text))
    unique: dict[str, list[str]] = {}
    for row in parsed:
        cells = [compact(cell) for cell in row]
        if not any(cells):
            continue
        key = '\x1f'.join(cells)
        unique.setdefault(key, cells)

    result: list[ImportRow] = []
    for cells in unique.values():
        cells += [''] * max(0, 8 - len(cells))
        source = cells[1] or 'Без источника'
        category = cells[2]
        event_raw = cells[6]
        comment = cells[7]
        event_date, unparsed_date = parse_event_date(event_raw, default_year)

        comment_parts = []
        if category:
            comment_parts.append(f'Тип/пометка из таблицы: {category}')
        if unparsed_date:
            comment_parts.append(f'Дата из таблицы: {unparsed_date}')
        if comment:
            comment_parts.append(comment)

        result.append(
            ImportRow(
                source=source,
                event_date=event_date,
                event_date_raw=unparsed_date,
                comment='\n'.join(comment_parts),
                status=infer_status(source, category, comment),
            )
        )
    return result


def import_rows(rows: list[ImportRow], apply: bool) -> tuple[int, int, int]:
    from app.core.database import SessionLocal
    from app.schemas.incoming_request import IncomingRequestCreate
    from app.services.incoming_request_service import IncomingRequestService

    db = SessionLocal()
    try:
        service = IncomingRequestService(db)
        existing = service.list_requests().requests
        existing_keys = {
            (
                compact(item.source_name).lower(),
                item.event_date.isoformat() if item.event_date else '',
                compact(item.comment).lower(),
            )
            for item in existing
        }

        created = 0
        skipped = 0
        for row in rows:
            key = (
                compact(row.source).lower(),
                row.event_date.isoformat() if row.event_date else '',
                compact(row.comment).lower(),
            )
            if key in existing_keys:
                skipped += 1
                continue
            if apply:
                service.create_request(
                    IncomingRequestCreate(
                        source=row.source,
                        event_date=row.event_date,
                        comment=row.comment,
                        status=row.status,
                    )
                )
            existing_keys.add(key)
            created += 1
        if not apply:
            db.rollback()
        return created, skipped, len(existing)
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description='Import incoming requests from Google Sheets CSV.')
    parser.add_argument('--csv-url')
    parser.add_argument('--csv-path')
    parser.add_argument('--default-year', type=int, default=2026)
    parser.add_argument('--timeout', type=int, default=20)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()

    csv_text = read_csv(args)
    rows = build_rows(csv_text, args.default_year)

    statuses = {'in_work': 0, 'signed': 0, 'rejected': 0}
    parsed_dates = 0
    raw_dates = 0
    sources: set[str] = set()
    for row in rows:
        statuses[row.status] += 1
        parsed_dates += int(row.event_date is not None)
        raw_dates += int(row.event_date_raw is not None)
        sources.add(row.source)

    print(f'parsed_unique_rows={len(rows)}')
    print(f'unique_sources={len(sources)}')
    print(f'parsed_dates={parsed_dates}')
    print(f'unparsed_dates_kept_in_comment={raw_dates}')
    print(f'statuses={statuses}')

    if args.apply:
        created, skipped, existing_count = import_rows(rows, apply=True)
        print(f'existing_before={existing_count}')
        print(f'created={created}')
        print(f'skipped_existing={skipped}')
    else:
        for row in rows[:10]:
            print(
                'sample '
                f'source={row.source!r} '
                f'event_date={row.event_date.isoformat() if row.event_date else None!r} '
                f'raw_date={row.event_date_raw!r} '
                f'status={row.status!r}'
            )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
