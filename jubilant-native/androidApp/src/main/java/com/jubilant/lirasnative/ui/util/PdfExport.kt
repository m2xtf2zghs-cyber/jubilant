package com.jubilant.lirasnative.ui.util

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.jubilant.lirasnative.R
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.max

data class PdfSection(
  val title: String,
  val lines: List<String>,
)

fun createSimplePdf(
  context: Context,
  fileNamePrefix: String,
  title: String,
  subtitle: String?,
  sections: List<PdfSection>,
): File {
  val ts = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
  val fileName = safeFileName("${fileNamePrefix}_${ts}.pdf")
  val outDir = File(context.cacheDir, "reports").apply { mkdirs() }
  val outFile = File(outDir, fileName)

  val doc = PdfDocument()

  val pageWidth = 595
  val pageHeight = 842
  val margin = 40

  val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    textSize = 16f
    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
  }
  val brandPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    textSize = 14f
    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
  }
  val subtitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    textSize = 11f
    typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
  }
  val sectionPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    textSize = 12f
    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
  }
  val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    textSize = 10f
    typeface = Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
  }
  val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    strokeWidth = 1f
    alpha = 60
  }

  val logoDrawable = ContextCompat.getDrawable(context, R.drawable.ic_launcher)
  val logoBmp = logoDrawable?.let { drawableToBitmap(it, 44, 44) }

  var pageNumber = 1
  var page = doc.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
  var canvas = page.canvas

  fun newPage() {
    doc.finishPage(page)
    pageNumber += 1
    page = doc.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
    canvas = page.canvas
  }

  var y = margin.toFloat()

  // Header
  val logoX = margin.toFloat()
  val logoY = y - 10
  if (logoBmp != null) {
    canvas.drawBitmap(logoBmp, logoX, logoY, null)
  }
  val titleX = logoX + (logoBmp?.width ?: 0) + 12f
  val brandName = context.getString(R.string.app_name)
  canvas.drawText(brandName, titleX, y + 16f, brandPaint)
  canvas.drawText(title, titleX, y + 36f, titlePaint)
  subtitle?.takeIf { it.isNotBlank() }?.let {
    canvas.drawText(it, titleX, y + 52f, subtitlePaint)
  }
  y += 68f
  canvas.drawLine(margin.toFloat(), y, (pageWidth - margin).toFloat(), y, linePaint)
  y += 18f

  fun ensureSpace(lines: Int = 1, extra: Float = 0f) {
    val needed = (lines * 14f) + extra
    if (y + needed > (pageHeight - margin)) {
      newPage()
      y = margin.toFloat()
    }
  }

  sections.forEach { section ->
    ensureSpace(lines = 2, extra = 10f)
    canvas.drawText(section.title, margin.toFloat(), y, sectionPaint)
    y += 16f

    section.lines.forEach { raw ->
      val line = raw.replace("\t", "  ")
      val maxChars = 110
      val chunks = line.chunked(maxChars).ifEmpty { listOf("") }
      chunks.forEach { chunk ->
        ensureSpace(lines = 1)
        canvas.drawText(chunk, margin.toFloat(), y, bodyPaint)
        y += 14f
      }
    }

    y += 8f
  }

  // Footer page number
  val footerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 9f; alpha = 160 }
  val footer = "Page $pageNumber"
  canvas.drawText(footer, (pageWidth - margin - max(0f, footerPaint.measureText(footer))).toFloat(), (pageHeight - 24).toFloat(), footerPaint)

  doc.finishPage(page)

  FileOutputStream(outFile).use { out ->
    doc.writeTo(out)
  }
  doc.close()

  return outFile
}

fun sharePdf(context: Context, file: File, chooserTitle: String = "Share PDF") {
  val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
  val intent = Intent(Intent.ACTION_SEND).apply {
    type = "application/pdf"
    putExtra(Intent.EXTRA_STREAM, uri)
    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
  }
  context.startActivity(Intent.createChooser(intent, chooserTitle))
}

private fun safeFileName(raw: String): String =
  raw.replace(Regex("[^A-Za-z0-9._-]"), "_")

private fun drawableToBitmap(drawable: android.graphics.drawable.Drawable, width: Int, height: Int): Bitmap {
  val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
  val canvas = Canvas(bmp)
  drawable.setBounds(0, 0, width, height)
  drawable.draw(canvas)
  return bmp
}
