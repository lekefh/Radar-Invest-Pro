#!/usr/bin/env python3
"""
atualizar_dividendos.py
Fase 1 — Histórico 18 meses: Yahoo Finance (t.dividends) — eventos já pagos
Fase 2 — Próximos 4 meses:   Investidor10 (scraping B3/CVM) — eventos declarados
         Substitui t.calendar do Yahoo que retornava só 1 evento futuro por ticker.
Roda diariamente via GitHub Actions.
"""

import json
import time
import sys
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta, date

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

try:
    import yfinance as yf
    import pandas as pd
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Execute: pip install yfinance pandas requests beautifulsoup4")
    sys.exit(1)

BRT      = timezone(timedelta(hours=-3))
ROOT     = Path(__file__).parent.parent
OUT_PATH = ROOT / "lib" / "dividendos.json"

_FUND_PATH = ROOT / "lib" / "fundamentais.json"
with open(_FUND_PATH, "r", encoding="utf-8") as _f:
    TICKERS = sorted(json.load(_f).keys())

TIPO_RENDIMENTO = {"ENGI11", "TAEE11", "KLBN11"}

MESES_PT = [
    "", "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

HEADERS_HTTP = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Referer": "https://investidor10.com.br/",
}


# ─────────────────────────────────────────────
#  Utilitários
# ─────────────────────────────────────────────

def prev_weekday(d: date) -> date:
    """Último dia útil antes de d (data-com = ex-date - 1 dia útil)."""
    prev = d - timedelta(days=1)
    while prev.weekday() >= 5:
        prev -= timedelta(days=1)
    return prev


def parse_br_date(s: str) -> date | None:
    """Converte '01/09/26' ou '01/09/2026' → date."""
    s = s.strip()
    for fmt in ("%d/%m/%y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def parse_valor(s: str) -> float | None:
    """'R$ 0,0234' → 0.0234"""
    s = re.sub(r"[^\d,]", "", s.strip()).replace(",", ".")
    try:
        v = float(s)
        return v if 0 < v < 500 else None
    except ValueError:
        return None


def tipo_from_ticker(ticker: str, tipo_raw: str) -> str:
    if ticker in TIPO_RENDIMENTO:
        return "RENDIMENTO"
    raw = tipo_raw.upper()
    if "JSCP" in raw or "JCP" in raw:
        return "JSCP"
    if "RENDIMENTO" in raw:
        return "RENDIMENTO"
    return "DIVIDENDO"


# ─────────────────────────────────────────────
#  Fase 2 — Investidor10 scraper
# ─────────────────────────────────────────────

def scrape_investidor10_mes(ano: int, mes: int) -> list[dict]:
    """
    Scrapa proventos declarados para um mês/ano do Investidor10.
    URL: investidor10.com.br/acoes/dividendos/{ano}/{mes_pt}/
    Fonte: B3 + CVM — cobre múltiplos eventos futuros por ticker,
    diferente do t.calendar do Yahoo que retorna só o próximo.
    """
    url = f"https://investidor10.com.br/acoes/dividendos/{ano}/{MESES_PT[mes]}/"
    print(f"  [Investidor10] {MESES_PT[mes]}/{ano} → {url}")

    try:
        resp = requests.get(url, headers=HEADERS_HTTP, timeout=20)
        resp.raise_for_status()
    except Exception as e:
        print(f"    ✗ Falha HTTP: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    # Localiza a tabela principal de dividendos
    table = soup.find("table")
    if not table:
        print(f"    ✗ Tabela não encontrada")
        return []

    # Detecta ordem das colunas pelo header
    headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
    def col(nome: str) -> int:
        for idx, h in enumerate(headers):
            if nome in h:
                return idx
        return -1

    idx_empresa  = col("empresa") if col("empresa") >= 0 else 0
    idx_data_com = col("data com") if col("data com") >= 0 else 1
    idx_data_pgto= col("pagamento") if col("pagamento") >= 0 else 2
    idx_tipo     = col("tipo") if col("tipo") >= 0 else 3
    idx_valor    = col("valor") if col("valor") >= 0 else 4

    resultado = []
    for row in table.find_all("tr")[1:]:
        cols = row.find_all("td")
        if len(cols) < 3:
            continue

        def txt(i: int) -> str:
            return cols[i].get_text(strip=True) if i < len(cols) else ""

        # Ticker: extrai do href /acoes/bbdc3/
        ticker = None
        empresa_cell = cols[idx_empresa] if idx_empresa < len(cols) else None
        if empresa_cell:
            a = empresa_cell.find("a", href=re.compile(r"/acoes/\w+"))
            if a:
                m = re.search(r"/acoes/([a-z0-9]+)/?", a["href"])
                if m:
                    ticker = m.group(1).upper()
            if not ticker:
                # Fallback: texto que parece ticker (4 letras + 1-2 dígitos)
                for part in empresa_cell.get_text(" ", strip=True).split():
                    if re.match(r'^[A-Z]{4}\d{1,2}$', part):
                        ticker = part
                        break

        if not ticker:
            continue

        data_com  = parse_br_date(txt(idx_data_com))
        data_pgto = parse_br_date(txt(idx_data_pgto))
        tipo_raw  = txt(idx_tipo)
        valor     = parse_valor(txt(idx_valor))

        if not data_com or not valor:
            continue

        # data_ex = dia útil seguinte à data-com
        data_ex = data_com + timedelta(days=1)
        while data_ex.weekday() >= 5:
            data_ex += timedelta(days=1)

        resultado.append({
            "ticker":          ticker,
            "tipo":            tipo_from_ticker(ticker, tipo_raw),
            "valor":           round(valor, 4),
            "data_com":        data_com.isoformat(),
            "data_ex":         data_ex.isoformat(),
            "data_pagamento":  data_pgto.isoformat() if data_pgto else None,
            "yield_pct":       None,   # calculado depois com preço atual
            "status":          "declarado",
            "fonte":           "investidor10",
        })

    print(f"    ✓ {len(resultado)} proventos")
    return resultado


def buscar_futuros_investidor10() -> list[dict]:
    """Busca declarados nos próximos 4 meses (mês atual + 3)."""
    hoje  = date.today()
    todos = []
    for offset in range(4):
        mes = hoje.month + offset
        ano = hoje.year
        while mes > 12:
            mes -= 12
            ano += 1
        todos.extend(scrape_investidor10_mes(ano, mes))
        time.sleep(1.5)
    return todos


# ─────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────

def main():
    corte    = datetime.now(timezone.utc) - timedelta(days=548)   # ~18 meses
    proventos: list[dict] = []
    sem_dados: list[str]  = []
    precos:    dict[str, float] = {}

    # ── Fase 1: histórico pago via Yahoo Finance ──────────────────────────
    print(f"=== Fase 1: Histórico Yahoo Finance ({len(TICKERS)} tickers) ===")

    for i, ticker in enumerate(TICKERS):
        print(f"  [{i+1}/{len(TICKERS)}] {ticker}", end=" ", flush=True)
        tipo = "RENDIMENTO" if ticker in TIPO_RENDIMENTO else "DIVIDENDO/JCP"

        try:
            t     = yf.Ticker(f"{ticker}.SA")
            info  = t.info or {}
            preco = info.get("regularMarketPrice") or info.get("currentPrice")
            if preco:
                precos[ticker] = preco

            divs = t.dividends
            if divs is None or len(divs) == 0:
                print("— sem histórico")
                sem_dados.append(ticker)
                time.sleep(0.4)
                continue

            divs_rec = divs[divs.index >= pd.Timestamp(corte)]
            count = 0
            for ex_ts, valor in divs_rec.items():
                ex_date = ex_ts.date() if hasattr(ex_ts, "date") else date.fromisoformat(str(ex_ts)[:10])
                if ex_date > date.today():
                    continue                         # futuros ficam com Investidor10
                com_date  = prev_weekday(ex_date)
                yield_pct = round((float(valor) / preco) * 100, 2) if preco and preco > 0 else None
                proventos.append({
                    "ticker":         ticker,
                    "tipo":           tipo,
                    "valor":          round(float(valor), 4),
                    "data_com":       com_date.isoformat(),
                    "data_ex":        ex_date.isoformat(),
                    "data_pagamento": None,
                    "yield_pct":      yield_pct,
                    "status":         "pago",
                    "fonte":          "yfinance",
                })
                count += 1

            print(f"✓ ({count} pagos)")

        except Exception as e:
            print(f"✗ Erro: {e}")
            sem_dados.append(ticker)

        time.sleep(0.5)

    # ── Fase 2: declarados futuros via Investidor10 ───────────────────────
    print(f"\n=== Fase 2: Declarados futuros — Investidor10 (próximos 4 meses) ===")
    futuros = buscar_futuros_investidor10()

    # Calcula yield com preços coletados na fase 1
    for p in futuros:
        preco = precos.get(p["ticker"])
        if preco and preco > 0:
            p["yield_pct"] = round((p["valor"] / preco) * 100, 2)

    # Merge sem duplicatas (chave: ticker + data_ex)
    chaves = {(p["ticker"], p["data_ex"]) for p in proventos}
    novos  = 0
    for p in futuros:
        chave = (p["ticker"], p["data_ex"])
        if chave not in chaves:
            proventos.append(p)
            chaves.add(chave)
            novos += 1

    print(f"  ✓ {len(futuros)} declarados do Investidor10 → {novos} novos adicionados após dedup")

    # ── Salva resultado ───────────────────────────────────────────────────
    proventos.sort(key=lambda x: x.get("data_ex", ""), reverse=True)

    resultado = {
        "atualizado": datetime.now(BRT).strftime("%d/%m/%Y %H:%M") + " [auto]",
        "total":      len(proventos),
        "fontes":     {"historico": "Yahoo Finance (18 meses pagos)", "futuros": "Investidor10 (B3/CVM, 4 meses)"},
        "proventos":  proventos,
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print(f"\n✓ {len(proventos)} proventos salvos em {OUT_PATH}")
    if sem_dados:
        print(f"  Sem dados yf: {', '.join(sem_dados)}")


if __name__ == "__main__":
    main()
