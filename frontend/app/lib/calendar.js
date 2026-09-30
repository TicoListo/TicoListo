export const dueItems = [
  { id: "marchamo", icon: "🚘", title: "Marchamo / impuesto vehicular", rule: "Cobro desde el 1 de noviembre; fecha límite sin recargo: 31 de diciembre.", date: "31 de diciembre", url: "https://www.ins-cr.com", source: "INS" },
  { id: "inspection", icon: "🔧", title: "Inspección técnica vehicular", rule: "Se programa una vez al año según el último dígito de la placa.", date: "Mes según placa", url: "https://www.dekra.cr", source: "DEKRA" },
  { id: "municipal", icon: "🏡", title: "Impuestos municipales", rule: "Los bienes inmuebles y servicios urbanos suelen pagarse trimestralmente.", date: "31 mar · 30 jun · 30 sep · 31 dic", url: "https://www.gob.cr", source: "Municipalidad respectiva" },
  { id: "income", icon: "🧾", title: "Impuesto sobre la renta D-101", rule: "Fecha límite anual indicada por Hacienda para la declaración y pago.", date: "15 de marzo", url: "https://www.atv.hacienda.go.cr", source: "Ministerio de Hacienda" },
  { id: "iva", icon: "📊", title: "IVA D-104", rule: "Se presenta y paga a más tardar el día 15 del mes siguiente.", date: "Día 15 de cada mes", url: "https://www.atv.hacienda.go.cr", source: "Ministerio de Hacienda" },
  { id: "ccss", icon: "🏥", title: "Cargas sociales CCSS", rule: "Revisa la fecha exacta indicada en la factura o cuenta institucional.", date: "Fecha de la factura", url: "https://edus.ccss.sa.cr", source: "CCSS" },
];

export const plateMonths = { "1": "Enero", "2": "Febrero", "3": "Marzo", "4": "Abril", "5": "Mayo", "6": "Junio", "7": "Julio", "8": "Agosto", "9": "Septiembre", "0": "Octubre" };

export const calendarPriorities = [
  ["all", "Todas las prioridades"],
  ["high", "Alta"],
  ["medium", "Media"],
  ["low", "Baja"],
];

export const calendarStatuses = [
  ["all", "Todos los estados"],
  ["pending", "Pendiente"],
  ["confirmed", "Confirmado"],
  ["completed", "Completado"],
  ["cancelled", "Cancelado"],
];

export function calendarDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateLabel(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}
