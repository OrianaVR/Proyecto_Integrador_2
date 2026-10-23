'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, Calendar, FileSpreadsheet, FileText,
  DollarSign, AlertCircle, CheckCircle2, TrendingUp,
  Search, RefreshCw, Loader2, CreditCard, ShieldAlert, Users,
  Bike, ArrowUpRight,
} from 'lucide-react';
import {
  getFinancialReport,
  downloadFinancialReportPdf,
  downloadFinancialReportExcel,
} from '@/services/api/endpoints';
import { getErrorMessage } from '@/services/api/client';
import type { ReporteFinanciero } from '@/types';

// Formateador de moneda en pesos colombianos (COP)
const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n || 0);

// Helpers para cálculo de fechas
function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPeriodDates(tipo: 'semanal' | 'mensual' | 'mes_anterior' | 'ultimos_30' | 'sin_datos') {
  const now = new Date();

  if (tipo === 'semanal') {
    // Lunes a domingo de la semana actual
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { inicio: toISODate(monday), fin: toISODate(sunday) };
  }

  if (tipo === 'mensual') {
    // Primer y último día del mes actual
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { inicio: toISODate(firstDay), fin: toISODate(lastDay) };
  }

  if (tipo === 'mes_anterior') {
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return { inicio: toISODate(firstDay), fin: toISODate(lastDay) };
  }

  if (tipo === 'ultimos_30') {
    const past = new Date(now);
    past.setDate(now.getDate() - 30);
    return { inicio: toISODate(past), fin: toISODate(now) };
  }

  // sin_datos: rango sin transacciones para evaluar el Criterio de Aceptación 2
  return { inicio: '2022-01-01', fin: '2022-01-31' };
}

export default function ReportesFinancierosPage() {
  const defaultDates = useMemo(() => getPeriodDates('mensual'), []);
  const [periodoPreset, setPeriodoPreset] = useState<'semanal' | 'mensual' | 'mes_anterior' | 'ultimos_30' | 'personalizado' | 'sin_datos'>('mensual');
  const [fechaInicio, setFechaInicio] = useState(defaultDates.inicio);
  const [fechaFin, setFechaFin] = useState(defaultDates.fin);

  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [reporte, setReporte] = useState<ReporteFinanciero | null>(null);
  const [activeTab, setActiveTab] = useState<'kpis' | 'transacciones' | 'clientes' | 'cuotas'>('kpis');
  const [searchTerm, setSearchTerm] = useState('');

  // Generar reporte
  const handleGenerarReporte = async (inicio = fechaInicio, fin = fechaFin, preset = periodoPreset) => {
    if (!inicio || !fin) {
      setErrorMsg('Debes seleccionar una fecha inicial y una fecha final.');
      return;
    }
    if (inicio > fin) {
      setErrorMsg('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const data = await getFinancialReport({
        fechaInicio: inicio,
        fechaFin: fin,
        periodo: preset,
      });
      setReporte(data);
    } catch (err: unknown) {
      console.error('Error generando reporte:', err);
      setErrorMsg(getErrorMessage(err, 'Error al procesar el reporte financiero.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Se difiere la primera carga para no actualizar el estado de forma síncrona dentro del efecto
    const timer = setTimeout(() => handleGenerarReporte(defaultDates.inicio, defaultDates.fin, 'mensual'), 0);
    return () => clearTimeout(timer);
  }, [defaultDates]);

  const handleSelectPreset = (preset: 'semanal' | 'mensual' | 'mes_anterior' | 'ultimos_30' | 'sin_datos') => {
    setPeriodoPreset(preset);
    const { inicio, fin } = getPeriodDates(preset);
    setFechaInicio(inicio);
    setFechaFin(fin);
    handleGenerarReporte(inicio, fin, preset);
  };

  const handleExportPDF = async () => {
    if (!reporte) return;
    setExportingPdf(true);
    try {
      await downloadFinancialReportPdf({
        fechaInicio,
        fechaFin,
        periodo: periodoPreset,
      });
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Error al exportar PDF'));
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!reporte) return;
    setExportingExcel(true);
    try {
      await downloadFinancialReportExcel({
        fechaInicio,
        fechaFin,
        periodo: periodoPreset,
      });
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Error al exportar Excel'));
    } finally {
      setExportingExcel(false);
    }
  };

  const transaccionesFiltradas = useMemo(() => {
    if (!reporte || !reporte.transacciones) return [];
    if (!searchTerm.trim()) return reporte.transacciones;
    const term = searchTerm.toLowerCase();
    return reporte.transacciones.filter(
      t =>
        t.clienteNombre.toLowerCase().includes(term) ||
        t.documentoId.includes(term) ||
        t.placa.toLowerCase().includes(term) ||
        t.metodoPago.toLowerCase().includes(term) ||
        t.referencia.toLowerCase().includes(term)
    );
  }, [reporte, searchTerm]);

  const cuotasFiltradas = useMemo(() => {
    if (!reporte || !reporte.cuotasDetalle) return [];
    if (!searchTerm.trim()) return reporte.cuotasDetalle;
    const term = searchTerm.toLowerCase();
    return reporte.cuotasDetalle.filter(
      c =>
        c.clienteNombre.toLowerCase().includes(term) ||
        c.documentoId.includes(term) ||
        c.placa.toLowerCase().includes(term) ||
        c.estado.toLowerCase().includes(term)
    );
  }, [reporte, searchTerm]);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto bg-[#141414] min-h-screen text-white">
        {/* Encabezado Principal */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C0001A] flex items-center justify-center text-white shadow-md shadow-[#C0001A]/20">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Reportes Financieros</h1>
                <p className="text-xs text-[#888888] mt-0.5">
                  Consolidado ejecutivo de ingresos, recaudos y saldo pendiente por periodo
                </p>
              </div>
            </div>
          </div>

          {/* Botones de Exportación - Estilo sobrio y ejecutivo */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportPDF}
              disabled={loading || exportingPdf || !reporte?.tieneDatos}
              title="Descargar reporte en formato PDF"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-white/10 hover:border-[#C0001A]/40 disabled:opacity-30 disabled:hover:bg-[#1F1F1F] disabled:hover:border-white/10 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {exportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C0001A]" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-[#C0001A]" />
              )}
              <span>Exportar PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={loading || exportingExcel || !reporte?.tieneDatos}
              title="Descargar datos en formato Excel (XLSX)"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-white/10 hover:border-[#C0001A]/40 disabled:opacity-30 disabled:hover:bg-[#1F1F1F] disabled:hover:border-white/10 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {exportingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C0001A]" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              )}
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Panel Selector de Periodos */}
        <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-[#A0A0A0]">
              <Calendar className="w-4 h-4 text-[#C0001A]" />
              <span>Rango de Consulta</span>
            </div>

            {/* Accesos rápidos */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleSelectPreset('semanal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  periodoPreset === 'semanal'
                    ? 'bg-[#C0001A] text-white shadow-sm'
                    : 'bg-[#141414] text-[#A0A0A0] hover:text-white border border-white/5 hover:border-white/10'
                }`}
              >
                Semanal
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('mensual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  periodoPreset === 'mensual'
                    ? 'bg-[#C0001A] text-white shadow-sm'
                    : 'bg-[#141414] text-[#A0A0A0] hover:text-white border border-white/5 hover:border-white/10'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('mes_anterior')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  periodoPreset === 'mes_anterior'
                    ? 'bg-[#C0001A] text-white shadow-sm'
                    : 'bg-[#141414] text-[#A0A0A0] hover:text-white border border-white/5 hover:border-white/10'
                }`}
              >
                Mes anterior
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('ultimos_30')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  periodoPreset === 'ultimos_30'
                    ? 'bg-[#C0001A] text-white shadow-sm'
                    : 'bg-[#141414] text-[#A0A0A0] hover:text-white border border-white/5 hover:border-white/10'
                }`}
              >
                Últimos 30 días
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('sin_datos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  periodoPreset === 'sin_datos'
                    ? 'bg-[#2A2A2A] text-white border border-[#C0001A]'
                    : 'bg-[#141414] text-[#777777] hover:text-[#A0A0A0] border border-white/5'
                }`}
                title="Prueba el Criterio de Aceptación 2 (Rango sin transacciones)"
              >
                Periodo sin datos
              </button>
            </div>
          </div>

          {/* Formulario de fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/5">
            <div>
              <label className="block text-[11px] font-medium text-[#777777] mb-1">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => {
                  setFechaInicio(e.target.value);
                  setPeriodoPreset('personalizado');
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-white/10 text-xs text-white focus:outline-none focus:border-[#C0001A] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#777777] mb-1">
                Fecha Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => {
                  setFechaFin(e.target.value);
                  setPeriodoPreset('personalizado');
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-white/10 text-xs text-white focus:outline-none focus:border-[#C0001A] transition-colors"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <button
                type="button"
                onClick={() => handleGenerarReporte(fechaInicio, fechaFin, periodoPreset)}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#C0001A] hover:bg-[#A00016] text-white font-semibold text-xs tracking-wide transition-all shadow-md shadow-[#C0001A]/20 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generar Reporte</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#141414] border border-[#C0001A]/40 text-[#FF8585] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#C0001A]" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* CRITERIO DE ACEPTACIÓN 2: Advertencia formal y sobria sin transacciones */}
        {reporte && !reporte.tieneDatos && !loading && (
          <div className="rounded-2xl border border-[#C0001A]/40 bg-[#1A1A1A] p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#C0001A]/10 border border-[#C0001A]/30 flex items-center justify-center text-[#C0001A] shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-[#A0A0A0] border border-white/10">
                    Aviso
                  </span>
                  <span className="text-xs text-[#666666]">
                    Periodo consultado: {reporte.fechaInicio} al {reporte.fechaFin}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">
                  {reporte.mensaje}
                </h3>
                <p className="text-xs text-[#888888]">
                  No se registraron transacciones financieras ni cuotas exigibles dentro del rango de fechas seleccionado.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPreset('mensual')}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-xs transition-colors shrink-0 cursor-pointer"
              >
                Consultar mes actual
              </button>
            </div>
          </div>
        )}

        {/* CRITERIO DE ACEPTACIÓN 1: Totales desplegados con estética sobria Black & Red */}
        {reporte && reporte.tieneDatos && (
          <div className="space-y-6">
            {/* Barra informativa */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 rounded-xl bg-[#1A1A1A] border border-white/10 text-xs text-[#888888]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#C0001A]" />
                <span className="text-white font-medium">Periodo activo:</span>
                <span>{reporte.fechaInicio} al {reporte.fechaFin}</span>
                <span className="text-white/20">|</span>
                <span className="capitalize">{reporte.periodo}</span>
              </div>
              <div>
                Generado: {new Date(reporte.fechaGeneracion).toLocaleTimeString('es-CO')}
              </div>
            </div>

            {/* 4 Tarjetas Métricas Ejecutivas (KPIs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. TOTAL RECAUDADO */}
              <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5 relative group hover:border-[#C0001A]/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">
                    Total Recaudado
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white">
                    <DollarSign className="w-4 h-4 text-[#C0001A]" />
                  </div>
                </div>
                <p className="text-2xl lg:text-3xl font-extrabold text-white mt-3 tracking-tight">
                  {fmt(reporte.totales.totalRecaudado)}
                </p>
                <p className="text-xs text-[#777777] mt-1.5">
                  <span className="text-white font-semibold">{reporte.totales.cantidadPagos}</span> pagos procesados
                </p>
              </div>

              {/* 2. SALDO PENDIENTE */}
              <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5 relative group hover:border-[#C0001A]/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">
                    Saldo Pendiente
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white">
                    <AlertCircle className="w-4 h-4 text-[#C0001A]" />
                  </div>
                </div>
                <p className="text-2xl lg:text-3xl font-extrabold text-white mt-3 tracking-tight">
                  {fmt(reporte.totales.totalSaldoPendiente)}
                </p>
                <p className="text-xs text-[#777777] mt-1.5">
                  <span className="text-[#FF8585] font-semibold">{reporte.totales.cuotasVencidas}</span> en mora · {reporte.totales.cuotasPendientes} por vencer
                </p>
              </div>

              {/* 3. INGRESOS EXIGIBLES */}
              <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5 relative group hover:border-[#C0001A]/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">
                    Ingresos Exigibles
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white">
                    <TrendingUp className="w-4 h-4 text-[#A0A0A0]" />
                  </div>
                </div>
                <p className="text-2xl lg:text-3xl font-extrabold text-white mt-3 tracking-tight">
                  {fmt(reporte.totales.totalIngresos)}
                </p>
                <p className="text-xs text-[#777777] mt-1.5">
                  <span className="text-white font-semibold">{reporte.totales.cuotasTotalesPeriodo}</span> cuotas programadas
                </p>
              </div>

              {/* 4. TASA DE RECAUDO */}
              <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5 relative group hover:border-[#C0001A]/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">
                    Tasa de Recaudo
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#C0001A]">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl lg:text-3xl font-extrabold text-white mt-3 tracking-tight">
                  {reporte.totales.tasaRecaudo}%
                </p>
                <div className="mt-2.5 w-full bg-white/10 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-[#C0001A] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, reporte.totales.tasaRecaudo)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Barra secundaria de métricas ejecutivas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-white/10 bg-[#1A1A1A] flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-[#888888]">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[11px] text-[#777777]">Mora del Periodo</p>
                  <p className="text-sm font-bold text-white">{fmt(reporte.totales.totalSaldoEnMora)}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-white/10 bg-[#1A1A1A] flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-[#888888]">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[11px] text-[#777777]">Cartera Global Flota</p>
                  <p className="text-sm font-bold text-white">{fmt(reporte.totales.saldoPendienteGlobal)}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-white/10 bg-[#1A1A1A] flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-[#888888]">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[11px] text-[#777777]">Clientes en Rango</p>
                  <p className="text-sm font-bold text-white">{reporte.desglosePorCliente.length}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-white/10 bg-[#1A1A1A] flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-[#888888]">
                  <Bike className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[11px] text-[#777777]">Cuotas Cubiertas</p>
                  <p className="text-sm font-bold text-white">
                    {reporte.totales.cuotasPagadas} de {reporte.totales.cuotasTotalesPeriodo}
                  </p>
                </div>
              </div>
            </div>

            {/* Pestañas de detalle */}
            <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] overflow-hidden">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 border-b border-white/10 bg-[#171717]">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('kpis')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'kpis'
                        ? 'bg-[#C0001A] text-white'
                        : 'text-[#888888] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Métodos de Pago
                  </button>
                  <button
                    onClick={() => setActiveTab('transacciones')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'transacciones'
                        ? 'bg-[#C0001A] text-white'
                        : 'text-[#888888] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Transacciones ({reporte.transacciones.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('clientes')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'clientes'
                        ? 'bg-[#C0001A] text-white'
                        : 'text-[#888888] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Por Cliente ({reporte.desglosePorCliente.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('cuotas')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'cuotas'
                        ? 'bg-[#C0001A] text-white'
                        : 'text-[#888888] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Cuotas del Periodo ({reporte.cuotasDetalle.length})
                  </button>
                </div>

                {activeTab !== 'kpis' && (
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666666]" />
                    <input
                      type="text"
                      placeholder="Filtrar datos..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1 rounded-lg bg-[#141414] border border-white/10 text-xs text-white placeholder-[#666666] focus:outline-none focus:border-[#C0001A]"
                    />
                  </div>
                )}
              </div>

              <div className="p-4">
                {/* 1: Métodos de Pago */}
                {activeTab === 'kpis' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#A0A0A0]">
                      Canales de Recaudo
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {reporte.desgloseMetodosPago.map(m => (
                        <div
                          key={m.metodo}
                          className="rounded-xl border border-white/10 bg-[#141414] p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-white">
                              {m.metodo}
                            </span>
                            <span className="text-[11px] font-medium text-[#777777]">
                              {m.cantidad} transacciones
                            </span>
                          </div>
                          <p className="text-lg font-bold text-white">
                            {fmt(m.montoTotal)}
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-[#777777]">
                              <span>Participación</span>
                              <span className="text-white font-mono">{m.porcentaje}%</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                              <div
                                className="bg-[#C0001A] h-full rounded-full"
                                style={{ width: `${m.porcentaje}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2: Transacciones */}
                {activeTab === 'transacciones' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-[#666666] uppercase text-[10px]">
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Documento</th>
                          <th className="py-2.5 px-3">Placa / Moto</th>
                          <th className="py-2.5 px-3">Cuota</th>
                          <th className="py-2.5 px-3">Método</th>
                          <th className="py-2.5 px-3">Referencia</th>
                          <th className="py-2.5 px-3 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {transaccionesFiltradas.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-[#666666]">
                              No se encontraron transacciones.
                            </td>
                          </tr>
                        ) : (
                          transaccionesFiltradas.map(t => (
                            <tr key={t.id} className="hover:bg-white/[0.02]">
                              <td className="py-2.5 px-3 text-[#A0A0A0] font-mono">{t.fechaPago}</td>
                              <td className="py-2.5 px-3 text-white font-medium">{t.clienteNombre}</td>
                              <td className="py-2.5 px-3 text-[#777777] font-mono">{t.documentoId}</td>
                              <td className="py-2.5 px-3 text-white">
                                <span className="font-bold text-[#C0001A]">{t.placa}</span>{' '}
                                <span className="text-[#666666]">({t.motocicleta})</span>
                              </td>
                              <td className="py-2.5 px-3 text-[#A0A0A0]">
                                {t.numeroCuota ? `#${t.numeroCuota}` : '—'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-white/5 text-[#A0A0A0]">
                                  {t.metodoPago}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-[#777777]">
                                {t.referencia || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-white font-mono">
                                {fmt(t.monto)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 3: Consolidado por Cliente */}
                {activeTab === 'clientes' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-[#666666] uppercase text-[10px]">
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Documento</th>
                          <th className="py-2.5 px-3">Placa</th>
                          <th className="py-2.5 px-3 text-center">Cuotas Periodo</th>
                          <th className="py-2.5 px-3 text-right">Recaudado</th>
                          <th className="py-2.5 px-3 text-right">Saldo Pendiente</th>
                          <th className="py-2.5 px-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {reporte.desglosePorCliente.map(c => (
                          <tr key={c.clienteId} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 font-medium text-white">{c.nombreCompleto}</td>
                            <td className="py-2.5 px-3 text-[#777777] font-mono">{c.documentoId}</td>
                            <td className="py-2.5 px-3 font-bold text-[#C0001A]">{c.placa}</td>
                            <td className="py-2.5 px-3 text-center text-[#A0A0A0]">
                              {c.cuotasPagadas} / {c.cuotasEsperadas}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-white font-mono">
                              {fmt(c.montoRecaudado)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-[#A0A0A0] font-mono">
                              {fmt(c.saldoPendientePeriodo)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-white/5 text-white border border-white/10">
                                {c.estadoContrato}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 4: Cuotas del Periodo */}
                {activeTab === 'cuotas' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-[#666666] uppercase text-[10px]">
                          <th className="py-2.5 px-3">Cuota</th>
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Placa</th>
                          <th className="py-2.5 px-3">Vencimiento</th>
                          <th className="py-2.5 px-3">Fecha Pago</th>
                          <th className="py-2.5 px-3">Monto</th>
                          <th className="py-2.5 px-3 text-center">Estado</th>
                          <th className="py-2.5 px-3 text-right">Mora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {cuotasFiltradas.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-[#666666]">
                              No se encontraron cuotas.
                            </td>
                          </tr>
                        ) : (
                          cuotasFiltradas.map(c => (
                            <tr key={c.id} className="hover:bg-white/[0.02]">
                              <td className="py-2.5 px-3 font-semibold text-white">#{c.numeroCuota}</td>
                              <td className="py-2.5 px-3 text-white font-medium">{c.clienteNombre}</td>
                              <td className="py-2.5 px-3 font-bold text-[#C0001A]">{c.placa}</td>
                              <td className="py-2.5 px-3 font-mono text-[#A0A0A0]">{c.fechaVencimiento}</td>
                              <td className="py-2.5 px-3 font-mono text-[#777777]">
                                {c.fechaPago || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-white font-mono">{fmt(c.monto)}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                    c.estado === 'pagado'
                                      ? 'bg-white/10 text-white'
                                      : c.estado === 'vencido'
                                      ? 'bg-[#C0001A]/20 text-[#FF8585] border border-[#C0001A]/40'
                                      : 'bg-white/5 text-[#A0A0A0]'
                                  }`}
                                >
                                  {c.estado}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                {c.diasMorosidad > 0 ? (
                                  <span className="text-[#FF8585] font-semibold">{c.diasMorosidad}d</span>
                                ) : (
                                  <span className="text-[#555555]">0d</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
