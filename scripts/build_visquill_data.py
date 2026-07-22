#!/usr/bin/env python3
"""Build the VisQuill Lens export data file from data/df.csv."""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "df.csv"
OUTPUT = ROOT / "data.json"
DETAILS_OUTPUT = ROOT / "school-details.json"

ETHOS = (
    "Catholic",
    "Church of Ireland",
    "Multi-denominational",
    "Inter-denominational",
    "Other",
)

ETHOS_COLORS = (
    "#8f3fb0",
    "#e07a3f",
    "#2a7fa3",
    "#58a58e",
    "#d1a72b",
)

PREFERENCE = (
    "Denominational",
    "Multi-denominational",
)

PREFERENCE_COLORS = (
    "#343a40",
    "#ff4f9a",
)

SCHOOL_TYPE = (
    "Single-sex",
    "Coeducational",
)

SCHOOL_TYPE_COLORS = (
    "#c43d32",
    "#5966b3",
)


def normalise_ethos(value: str) -> str:
    key = value.strip().lower().replace("-", " ")
    if key == "catholic":
        return "Catholic"
    if key == "church of ireland":
        return "Church of Ireland"
    if key == "multi denominational":
        return "Multi-denominational"
    if key == "inter denominational":
        return "Inter-denominational"
    return "Other"


def normalise_school_type(value: str) -> str:
    key = value.strip().lower().replace("-", " ")
    if key == "single sex":
        return "Single-sex"
    if key == "co educational":
        return "Coeducational"
    return "Unknown"


def finite_number(value: str) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def percentage(value: str) -> float | None:
    return finite_number(str(value or "").strip().removesuffix("%"))


def compact_number(value: float) -> str:
    return str(int(value)) if value.is_integer() else format(value, ".10g")


def lens_config(
    *,
    group: int,
    label: str,
    bars: tuple[str, ...],
    colors: tuple[str, ...],
) -> dict:
    return {
        "columns": [
            {
                "queryName": f"group{group}.{bar}",
                "displayName": bar,
            }
            for bar in bars
        ],
        "colors": list(colors),
        "type": "aggregation",
        "encoding": "percentage",
        "scaleType": "linear",
        "label": label,
        "homeLabel": "",
        "maxHeight": 120,
        "barWidth": 25,
        "preferredSegmentLength": 80,
        "autoScale": True,
        "maxValue": 100,
        "showValueLabels": True,
        "showCategoryLabels": True,
        "showBaseline": True,
        "baselineColor": "#888888",
        "titleColor": "#222222",
        "valueLabelColor": "#222222",
        "categoryLabelColor": "#ffffff",
        "showGridLines": True,
        "gridLineColor": "#cccccc",
        "gridLineDistance": 25,
        "homeBoxColor": "#1a1a2e",
    }


def build() -> tuple[dict, list[dict]]:
    ids: list[str] = []
    lats: list[str] = []
    lngs: list[str] = []
    ethos_values: list[str] = []
    preference_values: list[str] = []
    school_type_preference_values: list[str] = []
    school_details: list[dict] = []
    seen_ids: set[str] = set()

    with SOURCE.open(newline="", encoding="utf-8-sig") as source:
        for row in csv.DictReader(source):
            lat = finite_number(row.get("School Latitude", ""))
            lng = finite_number(row.get("School Longitude", ""))
            if lat is None or lng is None:
                continue

            ethos = normalise_ethos(row.get("Ethos Description", ""))
            ethos_values.append(",".join("1" if item == ethos else "0" for item in ETHOS))

            denominational = finite_number(
                row.get(
                    "Preference for denominational from parents with children in primary school",
                    "",
                )
            )
            multi_denominational = finite_number(
                row.get(
                    "Preference for multidenominational from parents with children in primary school",
                    "",
                )
            )
            preference_values.append(
                ",".join(
                    (
                        compact_number(denominational or 0.0),
                        compact_number(multi_denominational or 0.0),
                    )
                )
            )

            school_type = normalise_school_type(row.get("Coeducational/Singlesex", ""))
            single_sex = finite_number(
                row.get(
                    "Preference for singlesex from parents with children in primary school",
                    "",
                )
            )
            coeducational = finite_number(
                row.get(
                    "Preference for coeducational from parents with children in primary school",
                    "",
                )
            )
            school_type_preference_values.append(
                ",".join(
                    (
                        compact_number(single_sex or 0.0),
                        compact_number(coeducational or 0.0),
                    )
                )
            )

            lat_text = format(lat, ".10g")
            lng_text = format(lng, ".10g")
            school_id = row.get("Roll Number", "").strip() or f"{lat_text},{lng_text}"
            if school_id in seen_ids:
                raise ValueError(f"Duplicate school identifier: {school_id}")
            seen_ids.add(school_id)
            ids.append(school_id)
            lats.append(lat_text)
            lngs.append(lng_text)

            school_details.append(
                {
                    "id": school_id,
                    "name": row.get("Official School Name", "").strip()
                    or row.get("Official Name", "").strip()
                    or "Primary school",
                    "county": row.get("County", "").strip()
                    or row.get("County Description", "").strip(),
                    "ethos": ethos,
                    "schoolGender": school_type,
                    "denomPct": percentage(
                        row.get(
                            "Preference for denominational from parents with children in primary school (%)",
                            "",
                        )
                    ),
                    "multiPct": percentage(
                        row.get(
                            "Preference for multidenominational from parents with children in primary school (%)",
                            "",
                        )
                    ),
                    "singleSexPct": percentage(
                        row.get(
                            "Preference for singlesex from parents with children in primary school (%)",
                            "",
                        )
                    ),
                    "coedPct": percentage(
                        row.get(
                            "Preference for coeducational from parents with children in primary school (%)",
                            "",
                        )
                    ),
                }
            )

    layers = [
        {
            "type": "map",
            "config": {
                "style": {
                    "tileUrl": "https://tiles.openfreemap.org/styles/liberty",
                    "attribution": "© OpenFreeMap contributors © OpenStreetMap contributors",
                },
                "home": None,
                "bounds": {
                    "active": False,
                    "minLng": -180,
                    "minLat": -90,
                    "maxLng": 180,
                    "maxLat": 90,
                },
                "minZoom": 2,
                "maxZoom": 18,
                "dataPoints": {
                    "show": True,
                    "color": "rgba(51,51,51,0.7)",
                    "radius": 4,
                },
                "mapCenter": {
                    "lat": 53.35,
                    "lng": -7.65,
                    "zoom": 6.55,
                },
            },
        },
        {
            "type": "glass-pane",
            "config": {
                "show": True,
                "color": "rgba(255,255,255,0.48)",
            },
        },
        {
            "type": "lenses",
            "config": {
                "lensCount": 3,
                "lenses": [
                    lens_config(
                        group=1,
                        label="Ethos mix under the lens",
                        bars=ETHOS,
                        colors=ETHOS_COLORS,
                    ),
                    lens_config(
                        group=2,
                        label="Preferred Ethos",
                        bars=PREFERENCE,
                        colors=PREFERENCE_COLORS,
                    ),
                    lens_config(
                        group=3,
                        label="Preferred School Type",
                        bars=SCHOOL_TYPE,
                        colors=SCHOOL_TYPE_COLORS,
                    ),
                ],
                "lensesAtHome": {"1": False, "2": False, "3": False},
                "radiusSlider": {
                    "show": True,
                    "initial": 150,
                    "minimum": 10,
                    "units": "metric",
                },
                "homeBoxes": {"show": True},
                "interactions": {
                    "arcGrouping": True,
                    "lensSnapping": True,
                    "sharedScale": False,
                },
            },
        },
        {
            "type": "title",
            "config": {
                "title": "Primary School Lens Ireland",
                "subtitle": "Ethos, school type and parental preference",
            },
        },
    ]

    groups = [
        {
            "id": 1,
            "label": "Ethos mix under the lens",
            "bars": [{"label": item} for item in ETHOS],
        },
        {
            "id": 2,
            "label": "Preferred Ethos",
            "bars": [{"label": item} for item in PREFERENCE],
        },
        {
            "id": 3,
            "label": "Preferred School Type",
            "bars": [{"label": item} for item in SCHOOL_TYPE],
        },
    ]

    return {
        "version": 2,
        "layers": layers,
        "groups": groups,
        "points": {
            "ids": "\n".join(ids),
            "lats": "\n".join(lats),
            "lngs": "\n".join(lngs),
            "values": [
                "\n".join(ethos_values),
                "\n".join(preference_values),
                "\n".join(school_type_preference_values),
            ],
        },
    }, school_details


def main() -> None:
    payload, school_details = build()
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    DETAILS_OUTPUT.write_text(
        json.dumps(school_details, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    count = len(payload["points"]["lats"].splitlines())
    print(f"Wrote {OUTPUT} and {DETAILS_OUTPUT} with {count:,} mapped schools")


if __name__ == "__main__":
    main()
