#!/usr/bin/env python3
"""
atualizar_dividendos.py
Busca histórico de proventos (dividendos/JCP) dos últimos 18 meses via Yahoo Finance
e salva em lib/dividendos.json para exibição no Mapa de Proventos do site.
Roda diariamente via GitHub Actions.
"""

import json
import time
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta, date

try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    print("Execute: pip install yfinance pandas")
    sys.exit(1)

BRT = timezone(timedelta(hours=-3))
ROOT = Path(__file__).parent.parent
OUT_PATH = ROOT / "lib" / "dividendos.json"

# Todos os tickers monitorados (dashboard + teses)
TICKERS = [
    # Dashboard principal
    "ABEV3", "PETR4", "PETR3", "VALE3", "ITUB4", "ITUB3", "BBAS3", "WEGE3",
    "BBSE3", "VULC3", "AZZA3", "CYRE3", "PSSA3", "B3SA3", "CMIG4", "CMIG3",
    "RANI3", "RECV3", "SAPR3", "SAPR4", "LOGG3", "ABCB4", "BBDC4", "BBDC3",
    "ITSA4", "ITSA3", "SOJA3", "GRND3", "TEND3", "LAVV3", "BLAU3", "JHSF3",
    "ENGI11", "BRAV3", "MYPK3", "ROMI3", "VLID3", "LEVE3", "SBSP3", "COGN3",
    "USIM3", "USIM5", "PRIO3", "BRAP3", "BRAP4", "POMO3", "POMO4", "IRBR3",
    "TRIS3", "SUZB3", "KLBN11", "EGIE3", "TAEE11", "CPFE3", "CSAN3",
    # Teses extras
    "AXIA3", "EQTL3", "TAEE3", "CXSE3", "GMAT3", "INTB3", "KEPL3",
    "RIAA3", "CEAB3", "LREN3", "MGLU3",
]

# FIIs e Units pagam "RENDIMENTO", demais pagam "DIVIDENDO/JCP"
TIPO_RENDIMENTO = {"ENGI11", "TAEE11", "KLBN11"}

def prev_weekday(d: date) -> date:
    """Retorna o dia útil anterior (data-com = ex-date - 1 dia útil)."""
    prev = d - timedelta(days=1)
    while prev.weekday() >= 5:
        prev -= timedelta(days=1)
    return prev

def to_date_str(ts) -> str:
    try:
        if hasattr(ts, 'date'):
            return ts.date().isoformat()
        return str(ts)[:10]
    except Exception:
        return ""

def main():
    corte = datetime.now(timezone.utc) - timedelta(days=548)  # ~18 meses
    proventos: list[dict] = []
    sem_dados = []

    print(f"Buscando proventos de {len(TICKERS)} tickers (últimos 18 meses)...")

    for i, ticker in enumerate(TICKERS):
        print(f"  [{i+1}/{len(TICKERS)}] {ticker}", end=" ", flush=True)
        tipo = "RENDIMENTO" if ticker in TIPO_RENDIMENTO else "DIVIDENDO/JCP"

        try:
            t = yf.Ticker(f"{ticker}.SA")

            # Preço atual para calcular yield
            info = t.info or {}
            preco = info.get("regularMarketPrice") or info.get("currentPrice")

            # Histórico de dividendos
            divs = t.dividends
            if divs is None or len(divs) == 0:
                print("— sem histórico")
                sem_dados.append(ticker)
                time.sleep(0.4)
                continue

            # Filtrar últimos 18 meses
            divs_recentes = divs[divs.index >= pd.Timestamp(corte)]
            count = 0
            for ex_ts, valor in divs_recentes.items():
                ex_date = ex_ts.date() if hasattr(ex_ts, 'date') else date.fromisoformat(str(ex_ts)[:10])
                com_date = prev_weekday(ex_date)
                yield_pct = round((float(valor) / preco) * 100, 2) if preco and preco > 0 else None
                status = "pago" if ex_date <= date.today() else "declarado"
                proventos.append({
                    "ticker": ticker,
                    "tipo": tipo,
                    "valor": round(float(valor), 4),
                    "data_com": com_date.isoformat(),
                    "data_ex": ex_date.isoformat(),
                    "data_pagamento": None,  # yfinance histórico não tem essa info separada
                    "yield_pct": yield_pct,
                    "status": status,
                })
                count += 1

            # Próximo dividendo declarado (se o calendário tiver)
            try:
                cal = t.calendar
                if isinstance(cal, dict):
                    ex_next = cal.get("Ex-Dividend Date")
                    div_next = cal.get("Dividend Date")
                    amt = info.get("dividendRate")  # taxa anualizada — dividir por frequência
                    if ex_next and amt:
                        freq = info.get("payFreqMonths") or info.get("payoutFrequency") or 12
                        # Estimar valor por pagamento
                        valor_est = float(amt) / (12 / (freq if freq else 12))
                        ex_next_date = ex_next.date() if hasattr(ex_next, 'date') else date.fromisoformat(str(ex_next)[:10])
                        # Só adicionar se não estiver já no histórico
                        if ex_next_date > date.today():
                            proventos.append({
                                "ticker": ticker,
                                "tipo": tipo,
                                "valor": round(valor_est, 4),
                                "data_com": prev_weekday(ex_next_date).isoformat(),
                                "data_ex": ex_next_date.isoformat(),
                                "data_pagamento": div_next.date().isoformat() if div_next and hasattr(div_next, 'date') else None,
                                "yield_pct": round((valor_est / preco) * 100, 2) if preco and preco > 0 else None,
                                "status": "declarado",
                            })
                            count += 1
            except Exception:
                pass

            print(f"✓ ({count} proventos)")

        except Exception as e:
            print(f"✗ Erro: {e}")
            sem_dados.append(ticker)

        time.sleep(0.5)

    # Ordenar por data_ex decrescente
    proventos.sort(key=lambda x: x.get("data_ex", ""), reverse=True)

    resultado = {
        "atualizado": datetime.now(BRT).strftime("%d/%m/%Y %H:%M") + " [auto]",
        "total": len(proventos),
        "proventos": proventos,
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print(f"\n✓ {len(proventos)} proventos salvos em {OUT_PATH}")
    if sem_dados:
        print(f"  Sem dados: {', '.join(sem_dados)}")

if __name__ == "__main__":
    main()
