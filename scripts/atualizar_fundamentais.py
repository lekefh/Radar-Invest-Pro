#!/usr/bin/env python3
"""
atualizar_fundamentais.py
Atualiza métricas fundamentalistas em lib/fundamentais.json via Yahoo Finance.
Preserva: mr, govRespostas, gov, divEbit, nota (campos que não vêm do yfinance).
Roda diariamente via GitHub Actions pós-fechamento B3.
"""

import json
import time
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

try:
    import yfinance as yf
except ImportError:
    print("yfinance não encontrado. Execute: pip install yfinance")
    sys.exit(1)

BRT = timezone(timedelta(hours=-3))
ROOT = Path(__file__).parent.parent
FUND_PATH = ROOT / "lib" / "fundamentais.json"

# Campos que atualizamos do yfinance
CAMPOS_YFINANCE = {"pl", "pvp", "dy", "roe", "lpa", "vpa", "merc", "evEbit", "max52s"}

# Campos que NUNCA tocamos (dados enriquecidos manualmente ou pelo desktop)
CAMPOS_PRESERVAR = {"mr", "govRespostas", "gov", "divEbit", "nota", "nome", "setor"}

def safe_float(v, scale=1.0, minv=None, maxv=None):
    try:
        f = float(v) * scale
        if not (-1e9 < f < 1e9): return None
        if minv is not None and f < minv: return None
        if maxv is not None and f > maxv: return None
        return round(f, 4)
    except (TypeError, ValueError):
        return None

def fetch_metricas(ticker_sa: str) -> dict:
    try:
        info = yf.Ticker(ticker_sa).info
        if not info or info.get("regularMarketPrice") is None:
            return {}

        dy_raw = info.get("dividendYield")
        roe_raw = info.get("returnOnEquity")
        merc_raw = info.get("marketCap")

        return {
            "pl":     safe_float(info.get("trailingPE"),         minv=0, maxv=999),
            "pvp":    safe_float(info.get("priceToBook"),         minv=0, maxv=50),
            "dy":     safe_float(dy_raw, scale=100,               minv=0, maxv=80) if dy_raw else None,
            "roe":    safe_float(roe_raw, scale=100,              minv=-200, maxv=500) if roe_raw else None,
            "lpa":    safe_float(info.get("trailingEps")),
            "vpa":    safe_float(info.get("bookValue"),           minv=0),
            "merc":   safe_float(merc_raw, scale=1/1e9,           minv=0) if merc_raw else None,
            "evEbit": safe_float(info.get("enterpriseToEbitda"),  minv=0, maxv=200),
            "max52s": safe_float(info.get("fiftyTwoWeekHigh"),    minv=0),
        }
    except Exception as e:
        print(f"  Erro info {ticker_sa}: {e}")
        return {}

def main():
    if not FUND_PATH.exists():
        print(f"Arquivo não encontrado: {FUND_PATH}")
        sys.exit(1)

    with open(FUND_PATH, "r", encoding="utf-8") as f:
        dados = json.load(f)

    tickers = list(dados.keys())
    agora_brt = datetime.now(BRT).strftime("%d/%m/%Y %H:%M")
    atualizados = 0
    erros = 0

    print(f"Atualizando {len(tickers)} tickers...")

    for i, ticker in enumerate(tickers):
        print(f"  [{i+1}/{len(tickers)}] {ticker}", end=" ", flush=True)
        metricas = fetch_metricas(f"{ticker}.SA")

        if not metricas:
            print("— sem dados")
            erros += 1
        else:
            for campo, valor in metricas.items():
                if campo not in CAMPOS_PRESERVAR and valor is not None:
                    dados[ticker][campo] = valor
            dados[ticker]["atualizado"] = f"{agora_brt} [auto]"
            atualizados += 1
            print("✓")

        # Pausa para não sobrecarregar a API do Yahoo Finance
        time.sleep(0.5)

    with open(FUND_PATH, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)

    print(f"\n✓ {atualizados} tickers atualizados | {erros} sem dados")
    print(f"  Salvo em: {FUND_PATH}")

if __name__ == "__main__":
    main()
