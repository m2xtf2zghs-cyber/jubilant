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

private data class ColumnMap(
  val dateIdx: Int? = null,
  val narrationIdx: Int? = null,
  val debitIdx: Int? = null,
  val creditIdx: Int? = null,
  val balanceIdx: Int? = null,
)

private fun splitColumns(line: String): List<String> {
  val trimmed = line.trim()
  if (trimmed.isBlank()) return emptyList()
  return trimmed.split(Regex("\\s{2,}")).map { it.trim() }.filter { it.isNotBlank() }
}

private fun detectHeaderColumns(line: String): ColumnMap? {
  val parts = splitColumns(line.lowercase())
  if (parts.isEmpty()) return null
  val idxDate = parts.indexOfFirst { it.contains("date") }
  val idxNarr =
    parts.indexOfFirst {
      it.contains("narration") || it.contains("description") || it.contains("remarks") ||
        it.contains("particular") || it.contains("details")
    }
  val idxDebit = parts.indexOfFirst { it.contains("debit") || it.contains("withdrawal") || it.contains("dr") }
  val idxCredit = parts.indexOfFirst { it.contains("credit") || it.contains("deposit") || it.contains("cr") }
  val idxBal = parts.indexOfFirst { it.contains("balance") }
  val hits = listOf(idxDate, idxNarr, idxDebit, idxCredit, idxBal).count { it >= 0 }
  if (hits < 2) return null
  return ColumnMap(
    dateIdx = idxDate.takeIf { it >= 0 },
    narrationIdx = idxNarr.takeIf { it >= 0 },
    debitIdx = idxDebit.takeIf { it >= 0 },
    creditIdx = idxCredit.takeIf { it >= 0 },
    balanceIdx = idxBal.takeIf { it >= 0 },
  )
}

private fun parseRowWithColumns(parts: List<String>, columnMap: ColumnMap?): Triple<String?, String?, Triple<String?, String?, String?>> {
  if (parts.isEmpty() || columnMap == null) return Triple(null, null, extractAmounts(parts.joinToString(" ")))
  val date = columnMap.dateIdx?.let { parts.getOrNull(it) }
  val debit = columnMap.debitIdx?.let { parts.getOrNull(it) }
  val credit = columnMap.creditIdx?.let { parts.getOrNull(it) }
  val balance = columnMap.balanceIdx?.let { parts.getOrNull(it) }

  val narration =
    if (columnMap.narrationIdx != null) {
      val start = columnMap.narrationIdx
      val endCandidates = listOf(columnMap.debitIdx, columnMap.creditIdx, columnMap.balanceIdx).filterNotNull()
      val end = endCandidates.minOrNull()?.coerceAtLeast(start)
      if (end != null && end > start) parts.subList(start, end).joinToString(" ")
      else parts.getOrNull(start)
    } else null

  return Triple(date, narration, Triple(debit, credit, balance))
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
          var columnMap: ColumnMap? = null
          lines.forEachIndexed { rowNo, line ->
            if (columnMap == null) {
              val detected = detectHeaderColumns(line)
              if (detected != null) {
                columnMap = detected
                rawLines +=
                  RawStatementLine(
                    id = "f${fileIdx}_p${pageNo}_r${rowNo + 1}",
                    pageNo = pageNo,
                    rowNo = rowNo + 1,
                    rawRowText = line,
                    rawDateText = null,
                    rawNarrationText = null,
                    rawDrText = null,
                    rawCrText = null,
                    rawBalanceText = null,
                    rawLineType = RawLineType.NON_TXN_LINE,
                    extractionMethod = "pdfbox-table",
                    bboxJson = null,
                  )
                return@forEachIndexed
              }
            }

            val parts = splitColumns(line)
            val (colDate, colNarration, colAmounts) = parseRowWithColumns(parts, columnMap)
            val date = extractDate(line)
            val (dr, cr, bal) = if (colAmounts.first != null || colAmounts.second != null || colAmounts.third != null) {
              Triple(colAmounts.first, colAmounts.second, colAmounts.third)
            } else {
              extractAmounts(line)
            }
            val narration = colNarration ?: stripNumbers(line)
            rawLines +=
              RawStatementLine(
                id = "f${fileIdx}_p${pageNo}_r${rowNo + 1}",
                pageNo = pageNo,
                rowNo = rowNo + 1,
                rawRowText = line,
                rawDateText = extractDate(colDate) ?: date,
                rawNarrationText = narration.ifBlank { null },
                rawDrText = dr,
                rawCrText = cr,
                rawBalanceText = bal,
                rawLineType = RawLineType.NON_TXN_LINE,
                extractionMethod = if (columnMap != null) "pdfbox-table" else "pdfbox",
                bboxJson = null,
              )
          }
        }
      }
    }

    val (bankName, accountType) = detectBankMeta(combined.toString())
    StatementParseInput(rawLines = rawLines, bankName = bankName, accountType = accountType)
  }
