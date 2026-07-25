#!/usr/bin/env python3
"""
atualizar_fundamentais.py
Atualiza métricas fundamentalistas em lib/fundamentais.json via Yahoo Finance.
Preserva: mr, govRespostas, gov, nota (campos que não vêm do yfinance).
divEbit (DL/EBITDA) agora é auto-calculado; evEbit usa EV/EBIT real quando disponível.
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
CAMPOS_YFINANCE = {"pl", "pvp", "dy", "roe", "lpa", "vpa", "merc", "evEbit", "divEbit", "max52s"}

# Campos que NUNCA tocamos (dados enriquecidos manualmente ou pelo desktop)
CAMPOS_PRESERVAR = {"mr", "govRespostas", "gov", "nota", "nome", "setor"}

# Tickers onde o Yahoo Finance retorna bookValue/priceToBook da unit (SAPR11, etc.)
# em vez da ação individual ON/PN, gerando pvp e vpa errados.
# A unit correspondente não está no dataset, então corrigir_pvp_units() não resolve.
# Valores confirmados pelo Fundamentus — revisar a cada revisão tarifária relevante.
PVP_VPA_OVERRIDE: dict[str, dict] = {
    "SAPR3": {"pvp": 0.96, "vpa": 8.40},   # Fundamentus 24/07/2026
    "SAPR4": {"pvp": 0.96, "vpa": 8.40},   # mesmo negócio, PN sem liquidez
}

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

        dy_raw   = info.get("dividendYield")
        roe_raw  = info.get("returnOnEquity")
        merc_raw = info.get("marketCap")

        # EV/EBIT real: tenta enterpriseValue / ebit antes de cair no EV/EBITDA do Yahoo
        ev_ebit = None
        ev   = info.get("enterpriseValue")
        ebit = info.get("ebit")
        if ev and ebit and ebit > 0:
            ev_ebit = safe_float(ev / ebit, minv=0, maxv=200)
        if ev_ebit is None:
            # Fallback: Yahoo chama de enterpriseToEbitda mas é EV/EBITDA; aceitar como proxy
            ev_ebit = safe_float(info.get("enterpriseToEbitda"), minv=0, maxv=200)

        # DL/EBITDA: (dívida bruta - caixa) / EBITDA
        div_ebit = None
        divida   = info.get("totalDebt") or 0
        caixa    = (info.get("totalCash") or 0) + (info.get("shortTermInvestments") or 0)
        ebitda   = info.get("ebitda")
        if ebitda and ebitda > 0:
            dl = divida - caixa
            div_ebit = safe_float(dl / ebitda, minv=-20, maxv=30)

        return {
            "pl":      safe_float(info.get("trailingPE"),  minv=0, maxv=999),
            "pvp":     safe_float(info.get("priceToBook"), minv=0, maxv=50),
            "dy":      safe_float(dy_raw,  scale=100, minv=0, maxv=80)    if dy_raw  else None,
            "roe":     safe_float(roe_raw, scale=100, minv=-200, maxv=500) if roe_raw else None,
            "lpa":     safe_float(info.get("trailingEps")),
            "vpa":     safe_float(info.get("bookValue"),   minv=0),
            "merc":    safe_float(merc_raw, scale=1/1e9,   minv=0)        if merc_raw else None,
            "evEbit":  ev_ebit,
            "divEbit": div_ebit,
            "max52s":  safe_float(info.get("fiftyTwoWeekHigh"), minv=0),
        }
    except Exception as e:
        print(f"  Erro info {ticker_sa}: {e}")
        return {}

def corrigir_pvp_units(dados: dict) -> int:
    """
    Corrige P/VP de ações ON/PN onde o Yahoo usa o bookValue da unit correspondente.
    Ex: ENGI3 recebe VPA da ENGI11 → P/VP fica artificialmente baixo (0.23x em vez de ~1.0x).
    Estratégia: se o ticker base+"11" existir no dataset E tiver P/VP > 0.3,
    usa o P/VP da unit para o ticker individual.
    Funciona para todos os casos automaticamente sem lista hardcoded.
    """
    corrigidos = 0
    for ticker in list(dados.keys()):
        # Aplica apenas a ações ON (3) e PN (4/5/6) que têm unit correspondente
        if not (ticker.endswith("3") or ticker.endswith("4")
                or ticker.endswith("5") or ticker.endswith("6")):
            continue
        unit = ticker[:-1] + "11"
        if unit not in dados:
            continue
        pvp_unit = dados[unit].get("pvp")
        pvp_atual = dados[ticker].get("pvp")
        if pvp_unit and pvp_unit > 0.3 and pvp_atual and pvp_atual < 0.6:
            # P/VP atual suspeito (< 0.6) e unit tem valor confiável → corrigir
            dados[ticker]["pvp"] = pvp_unit
            corrigidos += 1
    return corrigidos


def main():
    if not FUND_PATH.exists():
        print(f"Arquivo não encontrado: {FUND_PATH}")
        sys.exit(1)

    with open(FUND_PATH, "r", encoding="utf-8-sig") as f:
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

        time.sleep(0.5)

    # Pós-processamento: corrige P/VP de ON/PN que recebem bookValue da unit no Yahoo
    corrigidos = corrigir_pvp_units(dados)
    if corrigidos:
        print(f"\n  ✓ P/VP corrigido em {corrigidos} tickers ON/PN (usou P/VP da unit correspondente)")

    # Override manual: tickers onde a unit não está no dataset e Yahoo retorna dados errados
    for ticker, vals in PVP_VPA_OVERRIDE.items():
        if ticker in dados:
            for campo, valor in vals.items():
                dados[ticker][campo] = valor
    if PVP_VPA_OVERRIDE:
        tickers_ov = [t for t in PVP_VPA_OVERRIDE if t in dados]
        print(f"  ✓ Override manual aplicado: {', '.join(tickers_ov)}")

    with open(FUND_PATH, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)

    print(f"\n✓ {atualizados} tickers atualizados | {erros} sem dados")
    print(f"  Salvo em: {FUND_PATH}")

if __name__ == "__main__":
    main()
