package com.jubilant.lirasnative.ui.util

import android.content.Context
import com.jubilant.lirasnative.shared.underwriting.UwTransaction
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayInputStream
import kotlin.math.abs

data class BankPdfParseResult(
  val bankName: String,
  val accountType: String,
  val periodStart: String,
  val periodEnd: String,
  val transactions: List<UwTransaction>,
  val rawTextSnippet: String,
)

private fun moneyToLong(raw: String?): Long? {
  val s = raw?.replace(",", "")?.replace("₹", "")?.trim().orEmpty()
  if (s.isBlank()) return null
  val n = s.toDoubleOrNull() ?: return null
  return n.toLong()
}

private fun normalizeDate(raw: String?): String? {
  val s = raw?.trim().orEmpty()
  if (s.isBlank()) return null

  // dd/mm/yyyy or dd-mm-yyyy
  val m1 = Regex("^(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})$").find(s)
  if (m1 != null) {
    val dd = m1.groupValues[1].padStart(2, '0')
    val mm = m1.groupValues[2].padStart(2, '0')
    val yy = m1.groupValues[3]
    val yyyy = if (yy.length == 2) "20$yy" else yy
    return "$yyyy-$mm-$dd"
  }

  // yyyy-mm-dd
  val m2 = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(s)
  if (m2 != null) return s

  return null
}

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

private fun parseLinesToTransactions(lines: List<String>): List<UwTransaction> {
  val txs = mutableListOf<UwTransaction>()
  val amountRe = Regex("-?\\d{1,3}(?:,\\d{2,3})*(?:\\.\\d{1,2})?")

  for (lineRaw in lines) {
    val line = lineRaw.replace("\\s+".toRegex(), " ").trim()
    if (line.length < 8) continue
    val tokens = line.split(" ")
    if (tokens.size < 4) continue

    val dateIso = normalizeDate(tokens.firstOrNull()) ?: continue

    val amounts =
      amountRe.findAll(line)
        .map { moneyToLong(it.value) }
        .filterNotNull()
        .toList()
    if (amounts.isEmpty()) continue

    val balance = amounts.last()

    val narration =
      line
        .removePrefix(tokens[0])
        .replace(amountRe, " ")
        .replace("\\s+".toRegex(), " ")
        .trim()
        .ifBlank { "-" }

    txs.add(UwTransaction(date = dateIso, narration = narration, debit = 0, credit = 0, balance = balance))
  }

  // Sort + de-dup (headers can repeat across pages)
  val dedup = LinkedHashMap<String, UwTransaction>()
  for (t in txs.sortedBy { it.date }) {
    val k = "${t.date}|${t.narration}|${t.debit}|${t.credit}|${t.balance ?: ""}"
    dedup.putIfAbsent(k, t)
  }
  val out = dedup.values.toMutableList()

  // Infer debit/credit from balance deltas when possible.
  var prevBalance: Long? = null
  for (i in out.indices) {
    val t = out[i]
    val bal = t.balance
    if (bal == null) continue
    if (prevBalance == null) {
      prevBalance = bal
      continue
    }
    val delta = bal - prevBalance
    val debit = if (delta < 0) abs(delta) else 0
    val credit = if (delta > 0) delta else 0
    out[i] = t.copy(debit = debit, credit = credit)
    prevBalance = bal
  }

  return out
}

suspend fun parseBankStatementPdfs(
  pdfBytes: List<ByteArray>,
  context: Context? = null,
): BankPdfParseResult =
  withContext(Dispatchers.Default) {
    require(pdfBytes.isNotEmpty()) { "Please select at least one PDF." }

    val combinedTextSb = StringBuilder()
    val allLines = mutableListOf<String>()

    runCatching {
      context?.applicationContext?.let { PDFBoxResourceLoader.init(it) }
    }

    for (bytes in pdfBytes) {
      PDDocument.load(ByteArrayInputStream(bytes)).use { doc ->
        val stripper = PDFTextStripper()
        val text = stripper.getText(doc)
        combinedTextSb.append("\n").append(text).append("\n")
        allLines.addAll(text.lines())
      }
    }

    val combinedText = combinedTextSb.toString()
    val (bankName, accountType) = detectBankMeta(combinedText)

    val transactions = parseLinesToTransactions(allLines)
    val periodStart = transactions.minOfOrNull { it.date }.orEmpty()
    val periodEnd = transactions.maxOfOrNull { it.date }.orEmpty()

    BankPdfParseResult(
      bankName = bankName,
      accountType = accountType,
      periodStart = periodStart,
      periodEnd = periodEnd,
      transactions = transactions,
      rawTextSnippet = combinedText.take(4000),
    )
  }
