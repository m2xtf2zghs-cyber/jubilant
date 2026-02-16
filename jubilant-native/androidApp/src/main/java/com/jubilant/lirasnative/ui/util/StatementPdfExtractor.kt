package com.jubilant.lirasnative.ui.util

import android.content.Context
import com.jubilant.lirasnative.shared.statement.RawLineType
import com.jubilant.lirasnative.shared.statement.RawStatementLine
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.ByteArrayInputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class StatementParseInput(
  val rawLines: List<RawStatementLine>,
  val bankName: String,
  val accountType: String,
)

private fun detectBankMeta(text: String): Pair<String, String> {
  val t = text.uppercase()
  val bankName =
    when {
      "HDFC" in t -> "HDFC"
      "ICICI" in t -> "ICICI"
      "AXIS" in t -> "AXIS"
      ("STATE BANK" in t) || ("SBI" in t) -> "SBI"
      "KOTAK" in t -> "KOTAK"
      "INDUSIND" in t -> "INDUSIND"
      "TMB" in t -> "TMB"
      else -> ""
    }
  val accountType =
    when {
      "SAVINGS" in t -> "SAVINGS"
      "CURRENT" in t -> "CURRENT"
      else -> ""
    }
  return bankName to accountType
}

private fun extractDate(raw: String?): String? {
  val s = raw?.trim().orEmpty()
  if (s.isBlank()) return null
  val m1 = Regex("(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})").find(s)
  if (m1 != null) {
    val dd = m1.groupValues[1].padStart(2, '0')
    val mm = m1.groupValues[2].padStart(2, '0')
    val yy = m1.groupValues[3]
    val yyyy = if (yy.length == 2) "20$yy" else yy
    return "$yyyy-$mm-$dd"
  }
  val m2 = Regex("(\\d{4})-(\\d{2})-(\\d{2})").find(s)
  return m2?.value
}

private fun extractAmounts(raw: String): Triple<String?, String?, String?> {
  val nums =
    Regex("-?\\d{1,3}(?:,\\d{2,3})*(?:\\.\\d{1,2})?")
      .findAll(raw)
      .map { it.value }
      .toList()
  if (nums.isEmpty()) return Triple(null, null, null)
  if (nums.size == 1) return Triple(null, null, nums.last())
  if (nums.size == 2) return Triple(nums.first(), null, nums.last())
  return Triple(nums[nums.size - 3], nums[nums.size - 2], nums.last())
}

private fun stripNumbers(raw: String): String {
  return raw.replace(Regex("-?\\d{1,3}(?:,\\d{2,3})*(?:\\.\\d{1,2})?"), " ")
    .replace(Regex("\\s+"), " ")
    .trim()
}

suspend fun extractStatementRawLines(
  pdfBytes: List<ByteArray>,
  context: Context? = null,
): StatementParseInput =
  withContext(Dispatchers.Default) {
    require(pdfBytes.isNotEmpty()) { "Please select at least one PDF." }

    val rawLines = mutableListOf<RawStatementLine>()
    val combined = StringBuilder()

    runCatching {
      context?.applicationContext?.let { PDFBoxResourceLoader.init(it) }
    }

    pdfBytes.forEachIndexed { fileIdx, bytes ->
      PDDocument.load(ByteArrayInputStream(bytes)).use { doc ->
        val pageCount = doc.numberOfPages
        val stripper = PDFTextStripper()
        for (pageNo in 1..pageCount) {
          stripper.startPage = pageNo
          stripper.endPage = pageNo
          val text = stripper.getText(doc)
          combined.append("\n").append(text)
          val lines = text.lines()
          lines.forEachIndexed { rowNo, line ->
            val date = extractDate(line)
            val (dr, cr, bal) = extractAmounts(line)
            val narration = stripNumbers(line)
            rawLines +=
              RawStatementLine(
                id = "f${fileIdx}_p${pageNo}_r${rowNo + 1}",
                pageNo = pageNo,
                rowNo = rowNo + 1,
                rawRowText = line,
                rawDateText = date,
                rawNarrationText = narration.ifBlank { null },
                rawDrText = dr,
                rawCrText = cr,
                rawBalanceText = bal,
                rawLineType = RawLineType.NON_TXN_LINE,
                extractionMethod = "pdfbox",
                bboxJson = null,
              )
          }
        }
      }
    }

    val (bankName, accountType) = detectBankMeta(combined.toString())
    StatementParseInput(rawLines = rawLines, bankName = bankName, accountType = accountType)
  }
