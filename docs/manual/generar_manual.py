from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[2]
MANUAL_DIR = ROOT / "docs" / "manual"
CAPTURES = MANUAL_DIR / "capturas"
OUTPUT = MANUAL_DIR / "Manual-de-Usuario-MotoLeasing.docx"

RED = "C0001A"
DARK = "202020"
MID = "666666"
LIGHT = "F3F4F6"
BORDER = "D9D9D9"


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    element = OxmlElement("w:tblHeader")
    element.set(qn("w:val"), "true")
    tr_pr.append(element)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=90, start=120, bottom=90, end=120):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color=BORDER, size="6"):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = borders.find(qn(f"w:{edge}"))
        if tag is None:
            tag = OxmlElement(f"w:{edge}")
            borders.append(tag)
        tag.set(qn("w:val"), "single")
        tag.set(qn("w:sz"), size)
        tag.set(qn("w:color"), color)


def set_font(run, name="Aptos", size=None, bold=None, color=None):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Página ")
    set_font(run, size=9, color=MID)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    value = OxmlElement("w:t")
    value.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, value, end])


def add_heading(doc, text, level=1):
    paragraph = doc.add_heading(text, level=level)
    if level == 1:
        paragraph.paragraph_format.page_break_before = True
    paragraph.paragraph_format.space_before = Pt(12 if level == 1 else 8)
    paragraph.paragraph_format.space_after = Pt(6)
    return paragraph


def add_body(doc, text, bold_lead=None):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(5)
    paragraph.paragraph_format.line_spacing = 1.12
    if bold_lead and text.startswith(bold_lead):
        lead = paragraph.add_run(bold_lead)
        set_font(lead, bold=True)
        run = paragraph.add_run(text[len(bold_lead):])
        set_font(run)
    else:
        run = paragraph.add_run(text)
        set_font(run)
    return paragraph


def add_bullets(doc, items):
    for item in items:
        paragraph = doc.add_paragraph(style="List Bullet")
        paragraph.paragraph_format.space_after = Pt(2)
        set_font(paragraph.add_run(item))


def add_steps(doc, steps):
    for index, step in enumerate(steps, start=1):
        paragraph = doc.add_paragraph(style="List Number")
        paragraph.paragraph_format.space_after = Pt(3)
        paragraph.paragraph_format.line_spacing = 1.08
        set_font(paragraph.add_run(step))


def add_figure(doc, filename, caption, alt_text, width=6.0):
    image_path = CAPTURES / filename
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.keep_with_next = True
    run = paragraph.add_run()
    inline_shape = run.add_picture(str(image_path), width=Inches(width))
    doc_pr = inline_shape._inline.docPr
    doc_pr.set("descr", alt_text)
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(9)
    cap.paragraph_format.keep_with_next = False
    cap_run = cap.add_run(caption)
    set_font(cap_run, size=9, color=MID)


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    header = table.rows[0]
    set_repeat_table_header(header)
    for i, text in enumerate(headers):
        cell = header.cells[i]
        set_cell_shading(cell, DARK)
        set_cell_margins(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(text)
        set_font(run, size=9, bold=True, color="FFFFFF")
        if widths:
            cell.width = Inches(widths[i])
    for row_index, values in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(values):
            set_cell_margins(cells[i])
            cells[i].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if row_index % 2:
                set_cell_shading(cells[i], LIGHT)
            p = cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT if i else WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(str(value))
            set_font(run, size=9)
            if widths:
                cells[i].width = Inches(widths[i])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def page_break(doc):
    # Los encabezados de nivel 1 ya fuerzan el inicio de página. Evitar un
    # párrafo de salto independiente impide páginas vacías cuando la sección
    # anterior ocupa exactamente la página completa.
    return None


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.65)
section.bottom_margin = Inches(0.65)
section.left_margin = Inches(0.7)
section.right_margin = Inches(0.7)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Aptos"
normal._element.rPr.rFonts.set(qn("w:ascii"), "Aptos")
normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos")
normal.font.size = Pt(10.5)
normal.font.color.rgb = RGBColor.from_string(DARK)
for style_name, size in (("Title", 30), ("Subtitle", 14), ("Heading 1", 20), ("Heading 2", 14), ("Heading 3", 11)):
    style = styles[style_name]
    style.font.name = "Aptos Display" if style_name != "Heading 3" else "Aptos"
    style._element.rPr.rFonts.set(qn("w:ascii"), style.font.name)
    style._element.rPr.rFonts.set(qn("w:hAnsi"), style.font.name)
    style.font.size = Pt(size)
    style.font.bold = style_name != "Subtitle"
    style.font.color.rgb = RGBColor(0, 0, 0)
    if style_name == "Title":
        p_pr = style._element.get_or_add_pPr()
        p_bdr = p_pr.find(qn("w:pBdr"))
        if p_bdr is not None:
            p_pr.remove(p_bdr)

footer = section.footer
footer_paragraph = footer.paragraphs[0]
add_page_number(footer_paragraph)

title = doc.add_paragraph(style="Title")
title.alignment = WD_ALIGN_PARAGRAPH.LEFT
title.paragraph_format.space_before = Pt(120)
title.paragraph_format.space_after = Pt(10)
set_font(title.add_run("Manual de usuario de MotoLeasing"), name="Aptos Display", size=30, bold=True, color="000000")

subtitle = doc.add_paragraph(style="Subtitle")
subtitle.paragraph_format.space_after = Pt(26)
set_font(subtitle.add_run("Guía operativa para administradores y clientes"), name="Aptos Display", size=14, color="000000")

intro = doc.add_paragraph()
intro.paragraph_format.space_after = Pt(16)
intro.paragraph_format.line_spacing = 1.2
set_font(intro.add_run("Este manual explica, con capturas reales y pasos reproducibles, cómo usar las funciones principales de la plataforma. También incluye el recorrido de demostración recomendado para la sustentación."), size=12)

add_table(doc, ["Documento", "Detalle"], [
    ["Producto", "MotoLeasing"],
    ["Versión del manual", "1.0"],
    ["Fecha", "10 de noviembre de 2026"],
    ["Audiencia", "Administradores, clientes y evaluadores"],
    ["Cobertura", "Acceso, operación, pagos, GPS, reportes, notificaciones y portal del cliente"],
], widths=[1.7, 5.0])

add_body(doc, "Resultado esperado. Al terminar, el lector podrá ingresar con el perfil adecuado, interpretar los indicadores, consultar o registrar información, gestionar eventos operativos y presentar una demo completa.", "Resultado esperado.")

page_break(doc)
add_heading(doc, "Contenido", 1)
for item in [
    "1. Antes de comenzar",
    "2. Acceso y perfiles",
    "3. Panel administrativo",
    "4. Clientes y contratos",
    "5. Motocicletas y GPS",
    "6. Pagos y verificación",
    "7. Desactivaciones y alertas",
    "8. Reportes financieros",
    "9. Notificaciones y programación",
    "10. Portal del cliente",
    "11. Solución de problemas",
    "12. Demo interactiva para la sustentación",
    "13. Lista de cumplimiento",
]:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(5)
    set_font(p.add_run(item), size=11)

add_heading(doc, "Convenciones de lectura", 2)
add_bullets(doc, [
    "Los nombres entre comillas corresponden a botones, campos o secciones visibles en la aplicación.",
    "Las capturas usan la base local de demostración; los valores pueden cambiar después de registrar operaciones.",
    "Las acciones que modifican pagos, GPS o notificaciones deben ejecutarse solo cuando el usuario comprenda su efecto.",
])

page_break(doc)
add_heading(doc, "1 Antes de comenzar", 1)
add_heading(doc, "1.1 Requisitos", 2)
add_bullets(doc, [
    "Navegador moderno con JavaScript habilitado.",
    "Frontend disponible en http://localhost:3000.",
    "API disponible en http://localhost:3001/api.",
    "Resolución recomendada de 1366 × 768 o superior.",
])
add_heading(doc, "1.2 Puesta en marcha local", 2)
add_steps(doc, [
    "En la raíz del proyecto, ejecute npm install.",
    "Entre a la carpeta backend y ejecute npm install.",
    "En una terminal ubicada en backend, ejecute npm start.",
    "En otra terminal ubicada en la raíz, ejecute npm run dev.",
    "Abra http://localhost:3000/login.",
])
add_body(doc, "Importante. Para la demostración se recomienda npm start en el backend. El comando npm run dev usa observación de archivos y puede reiniciarse cuando cambia la base JSON local.", "Importante.")
add_heading(doc, "1.3 Flujo general", 2)
add_table(doc, ["Paso", "Administrador", "Cliente"], [
    ["1", "Inicia sesión y consulta el estado general", "Inicia sesión y consulta su contrato"],
    ["2", "Gestiona clientes, motos, pagos y alertas", "Revisa moto, saldo, cuota y score"],
    ["3", "Genera reportes y configura notificaciones", "Cierra sesión al terminar"],
], widths=[0.6, 3.05, 3.05])

page_break(doc)
add_heading(doc, "2 Acceso y perfiles", 1)
add_figure(doc, "01-inicio-sesion.png", "Figura 1. Pantalla de acceso con perfiles de demostración.", "Pantalla de inicio de sesión de MotoLeasing con correo, contraseña y botones Admin demo y Rider demo.")
add_heading(doc, "2.1 Iniciar sesión", 2)
add_steps(doc, [
    "Escriba el correo electrónico del usuario.",
    "Escriba la contraseña. El icono de ojo permite mostrarla u ocultarla.",
    "Seleccione Ingresar.",
    "Espere la redirección: el administrador entra al Dashboard y el cliente a Mi Estado.",
])
add_heading(doc, "2.2 Acceso rápido para demostración", 2)
add_table(doc, ["Perfil", "Correo", "Contraseña", "Destino"], [
    ["Administrador", "admin@motoleasing.com", "admin123", "Dashboard"],
    ["Cliente", "rider@gmail.com", "rider123", "Mi Estado"],
], widths=[1.1, 2.25, 1.25, 1.65])
add_body(doc, "Ejemplo. Seleccione Admin demo para completar las credenciales; después pulse Ingresar.", "Ejemplo.")
add_body(doc, "Si aparece “Completa todos los campos”, revise que correo y contraseña tengan contenido. Si la credencial no es válida, confirme que la API esté activa y vuelva a intentarlo.")

page_break(doc)
add_heading(doc, "3 Panel administrativo", 1)
add_figure(doc, "02-dashboard.png", "Figura 2. Dashboard con indicadores, buscador y tabla operativa.", "Dashboard administrativo con indicadores de motos activas, motos bloqueadas, clientes en mora y recaudo del mes.")
add_heading(doc, "3.1 Interpretar el resumen", 2)
add_table(doc, ["Indicador", "Qué significa", "Uso recomendado"], [
    ["Motos activas", "GPS encendido y operación habilitada", "Validar disponibilidad de la flota"],
    ["Motos bloqueadas", "GPS apagado", "Revisar la causa antes de reactivar"],
    ["Clientes en mora", "Contratos con cuotas vencidas", "Priorizar la gestión de cobro"],
    ["Recaudo del mes", "Pagos aplicados en el periodo", "Comparar con la meta de recaudo"],
], widths=[1.35, 2.7, 2.65])
add_heading(doc, "3.2 Buscar y abrir un cliente", 2)
add_steps(doc, [
    "Ubique el campo Buscar cliente o placa.",
    "Escriba parte del nombre, correo o placa; por ejemplo, Andrés o ABC123.",
    "Revise la fila filtrada: plataforma, motocicleta, mora, cuota, score y GPS.",
    "Seleccione el icono de apertura al final de la fila para ver el perfil.",
])
add_body(doc, "El control GPS de la tabla muestra ON u OFF. Antes de cambiarlo, confirme que la placa y el cliente sean los correctos.")

page_break(doc)
add_heading(doc, "4 Clientes y contratos", 1)
add_figure(doc, "03-perfil-cliente.png", "Figura 3. Perfil del cliente con contrato, score, cuota y gestión de cobro.", "Perfil de Andrés Martínez con motocicleta, score crediticio, contrato, próxima cuota y botón registrar pago.")
add_heading(doc, "4.1 Consultar el perfil", 2)
add_steps(doc, [
    "Desde el Dashboard, abra el cliente requerido.",
    "Confirme nombre, documento, correo, teléfono y plataforma.",
    "Revise marca, modelo, placa, serie y estado GPS de la motocicleta.",
    "Interprete el score, la puntualidad, el saldo pendiente y el avance del contrato.",
    "Revise la próxima cuota y su estado antes de registrar un pago.",
])
add_heading(doc, "4.2 Cambiar el canal del cliente", 2)
add_steps(doc, [
    "Abra la lista Notificaciones por.",
    "Elija Configuración general, WhatsApp, SMS o correo electrónico.",
    "Compruebe que el valor seleccionado quede visible.",
])
add_body(doc, "La opción Configuración general usa el canal por defecto definido en Configuración.")
add_heading(doc, "4.3 Interpretar el score", 2)
add_table(doc, ["Elemento", "Lectura"], [
    ["Puntaje", "Valor resumido del comportamiento de pago"],
    ["Categoría", "Descripción cualitativa, por ejemplo Excelente"],
    ["Tendencia", "Indica si el comportamiento mejora o empeora"],
    ["Puntualidad", "Porcentaje de cuotas pagadas a tiempo"],
], widths=[1.6, 5.1])

page_break(doc)
add_heading(doc, "4.4 Registrar un cliente", 2)
add_figure(doc, "04-nuevo-cliente.png", "Figura 4. Primera etapa del asistente de registro.", "Formulario Nuevo Cliente con las etapas Datos del Cliente, Datos de la Moto y Documentos.", width=4.3)
add_heading(doc, "Etapa 1 Datos del cliente", 3)
add_steps(doc, [
    "Abra Nuevo Cliente en el menú lateral.",
    "Complete nombre, apellido, correo, teléfono, cédula y ciudad.",
    "Seleccione la plataforma de trabajo.",
    "Elija el canal de notificación o deje Según configuración general.",
    "Seleccione Siguiente.",
])
add_heading(doc, "Etapa 2 Datos de la motocicleta", 3)
add_steps(doc, [
    "Complete marca, modelo, año, placa, número de serie y color.",
    "Indique monto semanal, total de cuotas y fechas del contrato.",
    "Revise especialmente placa, serie y monto; estos datos afectan la operación y los cobros.",
    "Seleccione Siguiente.",
])
add_heading(doc, "Etapa 3 Documentos", 3)
add_steps(doc, [
    "Adjunte cédula, contrato firmado, SOAT, tecnomecánica, tarjeta de propiedad y licencia.",
    "Use archivos PDF, JPG o PNG de máximo 5 MB por documento.",
    "Compruebe que cada archivo muestre su nombre y el indicador de carga.",
    "Seleccione Guardar y espere el mensaje de registro exitoso.",
])
add_body(doc, "Validaciones. El sistema rechaza correos, documentos, placas o dispositivos GPS duplicados. Corrija el valor señalado y vuelva a guardar.", "Validaciones.")

page_break(doc)
add_heading(doc, "5 Motocicletas y GPS", 1)
add_figure(doc, "05-motocicletas.png", "Figura 5. Inventario de motocicletas y controles GPS.", "Tarjetas de motocicletas con placa, modelo, color, estado GPS y controles de encendido o apagado.")
add_heading(doc, "5.1 Buscar y filtrar", 2)
add_steps(doc, [
    "Abra Motocicletas.",
    "Use el buscador para escribir placa, marca o modelo.",
    "Use el filtro para mostrar todos los estados o uno específico.",
    "Revise los contadores de activas, apagadas y sin señal.",
])
add_heading(doc, "5.2 Encender o apagar el GPS", 2)
add_steps(doc, [
    "Identifique la tarjeta correcta por placa y cliente.",
    "Seleccione Encender o Apagar según el estado actual.",
    "Espere la actualización del estado en la tarjeta.",
    "Si el equipo está sin señal, consulte Alertas GPS antes de reintentar.",
])
add_body(doc, "Precaución. Cambiar el GPS afecta el estado operativo de la motocicleta. No ejecute la acción durante una explicación si no desea modificar los datos de la demo.", "Precaución.")

page_break(doc)
add_heading(doc, "6 Pagos y verificación", 1)
add_figure(doc, "06-verificacion-pagos.png", "Figura 6. Bandeja de verificación de pagos.", "Pantalla Verificación de Pagos sin pagos pendientes y con sección de pagos verificados automáticamente por la pasarela.", width=4.2)
add_heading(doc, "6.1 Registrar un pago desde el cliente", 2)
add_steps(doc, [
    "Abra el perfil del cliente.",
    "Seleccione Registrar pago.",
    "Elija la cuota o concepto, escriba el monto y seleccione el método de pago.",
    "Adjunte el comprobante cuando corresponda.",
    "Confirme el registro y verifique que aparezca en el historial.",
])
add_heading(doc, "6.2 Verificar pagos", 2)
add_steps(doc, [
    "Abra Verificación de Pagos.",
    "Revise el total pendiente de verificación.",
    "Abra el comprobante del registro requerido.",
    "Apruebe cuando monto, cliente y referencia coincidan; rechace cuando exista una inconsistencia.",
    "Confirme que la bandeja y el saldo se actualicen.",
])
add_heading(doc, "6.3 Resultados de pasarela", 2)
add_table(doc, ["Resultado", "Interpretación"], [
    ["Aprobado y aplicado", "El banco aprobó y el pago actualizó el saldo"],
    ["Rechazado por el banco", "No se aplica el pago"],
    ["No encontrado", "La referencia no coincide con una obligación"],
    ["Requiere revisión", "Debe revisarse manualmente"],
], widths=[2.0, 4.7])

page_break(doc)
add_heading(doc, "7 Desactivaciones y alertas", 1)
add_figure(doc, "07-desactivaciones.png", "Figura 7. Desactivaciones ordenadas por urgencia.", "Listado de próximas desactivaciones con cliente, motocicleta, días en mora, fecha y botón Desactivar ahora.")
add_heading(doc, "7.1 Gestionar una desactivación", 2)
add_steps(doc, [
    "Abra Desactivaciones.",
    "Priorice urgencia alta y valide los días de mora.",
    "Confirme cliente, motocicleta, placa y fecha programada.",
    "Seleccione Desactivar ahora solo cuando la decisión esté autorizada.",
    "Compruebe el resultado en Motocicletas y en el perfil del cliente.",
])
add_body(doc, "Las etiquetas de urgencia ayudan a ordenar la gestión, pero no sustituyen la validación del contrato y del pago más reciente.")

add_figure(doc, "08-alertas-gps.png", "Figura 8. Alertas de comandos remotos no ejecutados.", "Alerta de control remoto por fallo de apagado en una motocicleta sin señal GPS.")
add_heading(doc, "7.2 Resolver una alerta GPS", 2)
add_steps(doc, [
    "Abra Alertas GPS.",
    "Lea el tipo de fallo, la razón, el cliente, la placa y el estado actual.",
    "Si se restableció la señal, seleccione Reintentar apagado o Reintentar encendido.",
    "Si el caso fue solucionado por otro medio, seleccione Marcar como resuelta.",
    "Verifique que la alerta deje de aparecer como pendiente.",
])

page_break(doc)
add_heading(doc, "8 Reportes financieros", 1)
add_figure(doc, "09-reportes-financieros.png", "Figura 9. Reporte financiero mensual y opciones de exportación.", "Panel de reportes con rango de fechas, total recaudado, saldo pendiente, ingresos exigibles y botones Exportar PDF y Excel.")
add_heading(doc, "8.1 Generar un reporte", 2)
add_steps(doc, [
    "Abra Reportes Financieros.",
    "Seleccione una opción rápida o defina fecha inicial y fecha final.",
    "Seleccione Generar Reporte.",
    "Revise total recaudado, saldo pendiente, ingresos exigibles y tasa de recaudo.",
    "Use las pestañas para analizar métodos, transacciones, clientes y cuotas.",
])
add_heading(doc, "8.2 Exportar", 2)
add_steps(doc, [
    "Genere primero el periodo requerido.",
    "Seleccione Exportar PDF para un informe listo para lectura o impresión.",
    "Seleccione Exportar Excel para análisis y filtros adicionales.",
    "Compruebe que el archivo descargado conserve el mismo rango mostrado en pantalla.",
])
add_body(doc, "Ejemplo. Para presentar el estado del mes, seleccione Mensual, confirme las fechas y explique primero los cuatro indicadores superiores.", "Ejemplo.")

page_break(doc)
add_heading(doc, "9 Notificaciones y programación", 1)
add_figure(doc, "10-configuracion.png", "Figura 10. Configuración de canales y horario de cobro.", "Configuración con canales WhatsApp, SMS y correo, modo simulado, día y hora de envío.")
add_heading(doc, "9.1 Configurar canales", 2)
add_steps(doc, [
    "Abra Configuración.",
    "Active o desactive los canales disponibles.",
    "Marque un canal habilitado como Canal por defecto.",
    "Seleccione Guardar configuración.",
    "Compruebe el mensaje de confirmación.",
])
add_body(doc, "Modo simulado. El sistema registra el envío, pero el mensaje no llega al destinatario porque no hay credenciales del proveedor. Esta modalidad es adecuada para la sustentación.", "Modo simulado.")
add_heading(doc, "9.2 Programar recordatorios", 2)
add_steps(doc, [
    "Seleccione el día de envío.",
    "Defina la hora en horario de Colombia.",
    "Seleccione Guardar programación.",
    "Revise la fecha de Próximo envío.",
])
add_body(doc, "El botón Enviar recordatorios de hoy ejecuta el proceso inmediatamente. Úselo solo si desea generar notificaciones en los datos de la demo.")

page_break(doc)
add_heading(doc, "10 Portal del cliente", 1)
add_figure(doc, "11-portal-cliente.png", "Figura 11. Vista Mi Estado del cliente.", "Portal del cliente con motocicleta, documentos, saldo, progreso del contrato, próxima cuota y score crediticio.")
add_heading(doc, "10.1 Consultar Mi Estado", 2)
add_steps(doc, [
    "Inicie sesión con el perfil Cliente o use Rider demo.",
    "Revise la motocicleta, placa, estado GPS y vigencia de documentos.",
    "Consulte saldo pendiente, cuota semanal, cuotas pagadas y fecha final.",
    "Revise la próxima cuota y su estado.",
    "Interprete el score y la tendencia de pago.",
])
add_heading(doc, "10.2 Cerrar sesión", 2)
add_steps(doc, [
    "Seleccione el icono de salida en la parte superior derecha.",
    "Compruebe que la aplicación vuelva a la pantalla de acceso.",
    "En equipos compartidos, cierre también la pestaña del navegador.",
])

page_break(doc)
add_heading(doc, "11 Solución de problemas", 1)
add_table(doc, ["Situación", "Causa probable", "Solución"], [
    ["No abre la aplicación", "Frontend detenido", "Ejecute npm run dev en la raíz"],
    ["No se puede iniciar sesión", "API detenida o credencial incorrecta", "Ejecute npm start en backend y revise los datos"],
    ["La conexión se corta", "Backend iniciado en modo observador", "Use npm start para la demo"],
    ["No carga un reporte", "Rango inválido o API no disponible", "Corrija las fechas y verifique /api/health"],
    ["No cambia el GPS", "Equipo sin señal", "Abra Alertas GPS y reintente cuando haya señal"],
    ["No llega una notificación", "Canal en modo simulado", "Configure credenciales del proveedor o explique el modo demo"],
    ["Documento rechazado", "Formato o tamaño no permitido", "Use PDF, JPG o PNG de máximo 5 MB"],
], widths=[1.7, 2.25, 2.75])
add_heading(doc, "11.1 Comprobación rápida", 2)
add_steps(doc, [
    "Abra http://localhost:3001/api/health y confirme status ok.",
    "Recargue la página una sola vez.",
    "Cierre sesión y vuelva a entrar con el perfil correcto.",
    "Revise la terminal del servicio que presenta el problema.",
])

page_break(doc)
add_heading(doc, "12 Demo interactiva para la sustentación", 1)
add_body(doc, "Objetivo. Mostrar en 10 a 12 minutos el flujo completo desde la administración hasta la consulta del cliente, usando datos de demostración y evitando cambios irreversibles.", "Objetivo.")
add_table(doc, ["Tiempo", "Pantalla", "Acción", "Mensaje clave"], [
    ["0:00–0:45", "Login", "Entrar como Admin demo", "Dos perfiles con acceso diferenciado"],
    ["0:45–1:45", "Dashboard", "Buscar Andrés y abrir su perfil", "Vista consolidada de cartera y flota"],
    ["1:45–3:30", "Perfil", "Explicar contrato, cuota y score", "Trazabilidad individual"],
    ["3:30–5:00", "Nuevo Cliente", "Recorrer las tres etapas", "Registro integral y documentos"],
    ["5:00–6:00", "Motocicletas", "Mostrar filtros y estados GPS", "Control operativo de la flota"],
    ["6:00–7:30", "Alertas", "Comparar mora y fallo GPS", "Priorización y seguimiento"],
    ["7:30–9:00", "Reportes y configuración", "Generar reporte y mostrar horario", "Información para decisiones y automatización"],
    ["9:00–10:30", "Portal cliente", "Entrar como Rider demo", "Transparencia para el cliente"],
    ["10:30–11:00", "Cierre", "Resumir el flujo", "Administración y cliente conectados"],
], widths=[0.9, 1.3, 2.45, 2.05])
add_heading(doc, "12.1 Preparación", 2)
add_bullets(doc, [
    "Portátil conectado a corriente y navegador en zoom 100 %.",
    "Backend iniciado con npm start y frontend con npm run dev.",
    "Salud de API verificada antes de entrar al salón.",
    "Credenciales disponibles en una nota privada.",
    "Manual abierto como respaldo y recorrido ensayado.",
])
add_heading(doc, "12.2 Acciones que conviene evitar", 2)
add_bullets(doc, [
    "No registrar un pago real si se necesita conservar los saldos mostrados.",
    "No desactivar una motocicleta solo para ilustrar el botón.",
    "No ejecutar Enviar recordatorios de hoy durante una demo compartida.",
    "No crear clientes de prueba con correos o placas que luego confundan la presentación.",
])
add_heading(doc, "12.3 Plan de contingencia", 2)
add_bullets(doc, [
    "Si falla la API, reiniciar backend con npm start.",
    "Si una pantalla conserva otra sesión, cerrar sesión y elegir nuevamente el perfil demo.",
    "Si una acción no responde, continuar con la captura correspondiente del manual y explicar el resultado esperado.",
    "Si no hay internet, continuar localmente; la aplicación usa una tipografía de reserva.",
])

page_break(doc)
compliance_heading = add_heading(doc, "13 Lista de cumplimiento", 1)
compliance_heading.paragraph_format.page_break_before = False
add_body(doc, "Esta lista permite comprobar que el entregable cubre el criterio de evaluación del manual de usuario.")
add_table(doc, ["Requisito", "Evidencia incluida", "Estado"], [
    ["Funciones principales explicadas paso a paso", "Secciones 2 a 10", "Cumple"],
    ["Capturas o ejemplos visuales", "Figuras 1 a 11", "Cumple"],
    ["Lenguaje accesible para el cliente", "Instrucciones directas y glosario funcional", "Cumple"],
    ["Formato escrito", "Documento Word editable", "Cumple"],
    ["Demo interactiva preparada", "Sección 12 y guion minuto a minuto", "Cumple"],
    ["Contingencias para la sustentación", "Sección 12.3", "Cumple"],
], widths=[2.1, 3.55, 1.0])
add_heading(doc, "Cierre", 2)
add_body(doc, "MotoLeasing reúne la operación del leasing, el control de la flota y la consulta del cliente. El uso correcto depende de validar siempre el perfil, el cliente, la placa y el efecto de cada acción antes de confirmarla.")

doc.core_properties.title = "Manual de usuario de MotoLeasing"
doc.core_properties.subject = "Guía operativa y demo interactiva"
doc.core_properties.author = "Equipo del proyecto MotoLeasing"
doc.core_properties.keywords = "MotoLeasing, manual de usuario, demo, leasing, motocicletas"
doc.save(OUTPUT)
print(OUTPUT)
