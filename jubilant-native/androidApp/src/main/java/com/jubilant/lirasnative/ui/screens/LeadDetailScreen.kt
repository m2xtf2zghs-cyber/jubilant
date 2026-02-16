package com.jubilant.lirasnative.ui.screens

import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowDropDown
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Divider
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.di.PdRepository
import com.jubilant.lirasnative.di.UnderwritingRepository
import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.LeadDocuments
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.shared.supabase.LoanDetails
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.shared.supabase.RejectionDetails
import com.jubilant.lirasnative.shared.supabase.StorageObject
import com.jubilant.lirasnative.sync.RetrySyncScheduler
import com.jubilant.lirasnative.ui.components.PipelineStage
import com.jubilant.lirasnative.ui.components.StatusPipelineBar
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.PdfSection
import com.jubilant.lirasnative.ui.util.LoanFrequency
import com.jubilant.lirasnative.ui.util.calculateInterestRatePercent
import com.jubilant.lirasnative.ui.util.createSimplePdf
import com.jubilant.lirasnative.ui.util.followUpAt50PctTerm
import com.jubilant.lirasnative.ui.util.formatTenureShort
import com.jubilant.lirasnative.ui.util.frequencyTenureLabel
import com.jubilant.lirasnative.ui.util.isoToKolkataLocalDateTime
import com.jubilant.lirasnative.ui.util.nowKolkataDate
import com.jubilant.lirasnative.ui.util.parseLoanFrequency
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import com.jubilant.lirasnative.ui.util.sharePdf
import com.jubilant.lirasnative.ui.util.showDatePicker
import com.jubilant.lirasnative.ui.util.showTimePicker
import java.io.File
import java.io.FileOutputStream
import java.net.URLConnection
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import kotlinx.coroutines.launch

@Composable
fun LeadDetailScreen(
  leadId: String,
  leadsRepository: LeadsRepository,
  underwritingRepository: UnderwritingRepository,
  pdRepository: PdRepository,
  mediators: List<Mediator>,
  session: SessionState,
  onEdit: () -> Unit,
  onDeleted: () -> Unit,
  onMutated: () -> Unit,
) {
  val scope = rememberCoroutineScope()
  val context = LocalContext.current
  val actor = session.myProfile?.email ?: session.userId ?: "unknown"

  var loading by remember { mutableStateOf(true) }
  var busy by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  var lead by remember { mutableStateOf<Lead?>(null) }

  var addNoteText by remember { mutableStateOf("") }
  var showDelete by remember { mutableStateOf(false) }
  var showPayment by remember { mutableStateOf(false) }
  var showMeeting by remember { mutableStateOf(false) }
  var showFollowUp by remember { mutableStateOf(false) }
  var showReject by remember { mutableStateOf(false) }
  var showCommercialVisit by remember { mutableStateOf(false) }
  var rejectionPdfBusy by remember { mutableStateOf(false) }
  var rejectionPdfError by remember { mutableStateOf<String?>(null) }
  var assignExpanded by remember { mutableStateOf(false) }

  var attachments by remember { mutableStateOf<List<StorageObject>>(emptyList()) }
  var attachmentsLoading by remember { mutableStateOf(false) }
  var attachmentsBusy by remember { mutableStateOf(false) }
  var attachmentsError by remember { mutableStateOf<String?>(null) }

  var pipelineBusy by remember { mutableStateOf(false) }
  var pipelineError by remember { mutableStateOf<String?>(null) }
  var latestUwAppId by remember { mutableStateOf<String?>(null) }
  var pdStatus by remember { mutableStateOf<String?>(null) }

  LaunchedEffect(leadId) {
    loading = true
    error = null
    lead =
      runCatching { leadsRepository.getLead(leadId) }
        .onFailure { error = it.message ?: "Couldn’t load lead." }
        .getOrNull()
    loading = false

    pipelineBusy = true
    pipelineError = null
    latestUwAppId =
      runCatching { underwritingRepository.listApplications(leadId = leadId, limit = 1).firstOrNull()?.id }
        .onFailure { pipelineError = it.message ?: "Couldn’t load underwriting status." }
        .getOrNull()
    pdStatus =
      latestUwAppId
        ?.takeIf { it.isNotBlank() }
        ?.let { appId ->
          runCatching { pdRepository.getSessionByApplicationId(applicationId = appId)?.status }.getOrNull()
        }
    pipelineBusy = false

    attachmentsLoading = true
    attachmentsError = null
    attachments =
      runCatching { leadsRepository.listLeadAttachments(leadId = leadId, limit = 200) }
        .onFailure { attachmentsError = it.message ?: "Couldn’t load attachments." }
        .getOrNull()
        .orEmpty()
    attachmentsLoading = false
  }

  fun update(patch: LeadUpdate, successToast: String? = null) {
    val current = lead ?: return
    val optimistic =
      current.copy(
        ownerId = patch.ownerId ?: current.ownerId,
        name = patch.name ?: current.name,
        phone = patch.phone ?: current.phone,
        company = patch.company ?: current.company,
        location = patch.location ?: current.location,
        status = patch.status ?: current.status,
        loanAmount = patch.loanAmount ?: current.loanAmount,
        nextFollowUp = patch.nextFollowUp ?: current.nextFollowUp,
        mediatorId = patch.mediatorId ?: current.mediatorId,
        isHighPotential = patch.isHighPotential ?: current.isHighPotential,
        assignedStaff = patch.assignedStaff ?: current.assignedStaff,
        documents = patch.documents ?: current.documents,
        notes = patch.notes ?: current.notes,
        loanDetails = patch.loanDetails ?: current.loanDetails,
        rejectionDetails = patch.rejectionDetails ?: current.rejectionDetails,
      )
    // Optimistic UI: keep local state in sync with user edits, even if network fails.
    lead = optimistic
    scope.launch {
      busy = true
      error = null
      val updated =
        runCatching { leadsRepository.updateLead(current.id, patch) }
          .onFailure { ex ->
            // Queue for retry (online-first with offline safety).
            val appCtx = context.applicationContext
            val patchNoNotes = patch.copy(notes = null)
            if (patchNoNotes != LeadUpdate()) {
              RetryQueueStore.enqueueLeadUpdate(appCtx, current.id, patchNoNotes)
            }

            val appendedNotes =
              patch.notes
                ?.filterNot { n ->
                  current.notes.any { it.date == n.date && it.text == n.text && (it.byUser ?: "") == (n.byUser ?: "") }
                }
                .orEmpty()
            appendedNotes.forEach { note -> RetryQueueStore.enqueueLeadAppendNote(appCtx, current.id, note) }

            RetrySyncScheduler.enqueueNow(appCtx)
            Toast.makeText(context, "Saved offline — will sync when online.", Toast.LENGTH_LONG).show()
          }
          .getOrNull()
      if (updated != null) {
        lead = updated
        onMutated()
        successToast?.takeIf { it.isNotBlank() }?.let {
          Toast.makeText(context, it, Toast.LENGTH_SHORT).show()
        }
      }
      busy = false
    }
  }

  fun refreshAttachments() {
    scope.launch {
      attachmentsLoading = true
      attachmentsError = null
      val items =
        runCatching { leadsRepository.listLeadAttachments(leadId = leadId, limit = 200) }
          .onFailure { attachmentsError = it.message ?: "Couldn’t load attachments." }
          .getOrNull()
          .orEmpty()
      attachments = items
      attachmentsLoading = false
    }
  }

  fun appendNote(text: String) {
    val current = lead ?: return
    val note =
      LeadNote(
        text = text,
        date = java.time.Instant.now().toString(),
        byUser = actor,
      )
    val nextNotes = (current.notes + note).takeLast(500)
    update(LeadUpdate(notes = nextNotes))
  }

  fun exportRejectionLetterPdf(current: Lead) {
    if (rejectionPdfBusy) return
    rejectionPdfBusy = true
    rejectionPdfError = null
    scope.launch {
      runCatching {
        val mediatorName = mediators.firstOrNull { it.id == current.mediatorId }?.name ?: "Direct / None"
        val status = (current.status ?: "Not Eligible").trim().ifBlank { "Not Eligible" }
        val rej = current.rejectionDetails

        val reason =
          rej?.reason?.trim()?.takeIf { it.isNotBlank() }
            ?: current.notes
              .asReversed()
              .firstOrNull { it.text.contains("REJECTION", ignoreCase = true) || it.text.contains("REASON", ignoreCase = true) }
              ?.text
              ?.let { raw ->
                raw.substringAfter("Reason=", raw)
                  .substringAfter("REASON:", raw)
                  .substringAfter("]:", raw)
                  .trim()
              }
              ?.takeIf { it.isNotBlank() }
            ?: "Not eligible according to current policy criteria."

        val defense = rej?.defense?.trim().orEmpty()
        val strategy = rej?.strategy?.trim().orEmpty()
        val competitor = rej?.competitor?.trim().orEmpty()

        val created = current.createdAt?.let { isoToKolkataLocalDateTime(it)?.toString() }.orEmpty()
        val updated = current.updatedAt?.let { isoToKolkataLocalDateTime(it)?.toString() }.orEmpty()

        val sections =
          listOf(
            PdfSection(
              title = "Applicant",
              lines =
                listOfNotNull(
                  "Name: ${current.name}",
                  current.company?.takeIf { it.isNotBlank() }?.let { "Company: $it" },
                  current.location?.takeIf { it.isNotBlank() }?.let { "Location: $it" },
                  current.phone?.takeIf { it.isNotBlank() }?.let { "Phone: $it" },
                ),
            ),
            PdfSection(
              title = "Reference",
              lines =
                listOfNotNull(
                  "Reference ID: ${current.id}",
                  "Status: $status",
                  "Mediator: $mediatorName",
                  current.loanAmount?.takeIf { it > 0 }?.let { "Requested Amount: ${formatCompactInr(it)}" },
                  created.takeIf { it.isNotBlank() }?.let { "Created: $it" },
                  updated.takeIf { it.isNotBlank() }?.let { "Last Updated: $it" },
                ),
            ),
            PdfSection(
              title = "Decision",
              lines =
                listOfNotNull(
                  strategy.takeIf { it.isNotBlank() }?.let { "Strategy: $it" },
                  "Reason: $reason",
                  competitor.takeIf { it.isNotBlank() }?.let { "Competitor: $it" },
                  defense.takeIf { it.isNotBlank() }?.let { "Defense: $it" },
                ),
            ),
          )

        val file =
          createSimplePdf(
            context = context,
            fileNamePrefix = "rejection_${current.id.takeLast(6)}",
            title = "Jubilant Capital • Rejection Notice",
            subtitle = "Generated: ${nowKolkataDate()} • Confidential",
            sections = sections,
          )
        sharePdf(context, file, chooserTitle = "Share rejection letter")
      }.onFailure { ex ->
        rejectionPdfError = ex.message ?: "Couldn’t generate rejection letter."
      }
      rejectionPdfBusy = false
    }
  }

  if (loading) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(24.dp),
      horizontalArrangement = Arrangement.Center,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      CircularProgressIndicator()
    }
    return
  }

  val l = lead ?: run {
    ErrorCard(message = error ?: "Lead not found.")
    return
  }

  fun resolveObjectPath(obj: StorageObject): String {
    val n = obj.name.trim()
    return if (n.startsWith("leads/")) n else "leads/$leadId/$n"
  }

  fun resolveDisplayName(obj: StorageObject): String = obj.name.substringAfterLast('/').ifBlank { "attachment" }

  fun resolveDisplayName(uri: Uri): String {
    val cr = context.contentResolver
    val name =
      runCatching {
        cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) cursor.getString(0) else null
        }
      }.getOrNull()
    return name?.takeIf { it.isNotBlank() } ?: "attachment"
  }

  val pickAttachment =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
      if (uri == null) return@rememberLauncherForActivityResult
      scope.launch {
        attachmentsBusy = true
        attachmentsError = null
        runCatching {
          runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
          val fileName = resolveDisplayName(uri)
          val contentType =
            context.contentResolver.getType(uri)
              ?: URLConnection.guessContentTypeFromName(fileName)
              ?: "application/octet-stream"
          val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Couldn’t read file.")
          leadsRepository.uploadLeadAttachment(leadId = leadId, fileName = fileName, bytes = bytes, contentType = contentType)
          appendNote("[ATTACHMENT]: Uploaded $fileName")
          refreshAttachments()
        }.onFailure { ex ->
          attachmentsError = ex.message ?: "Upload failed."
        }
        attachmentsBusy = false
      }
    }

  val pipelineStage =
    remember(l.status, latestUwAppId, pdStatus) {
      computePipelineStage(
        leadStatus = l.status,
        hasUnderwriting = !latestUwAppId.isNullOrBlank(),
        pdStarted = !pdStatus.isNullOrBlank(),
        pdCompleted = pdStatus?.equals("completed", ignoreCase = true) == true,
      )
    }

  var selectedTab by rememberSaveable { mutableStateOf(0) }
  val leadScroll = rememberScrollState()
  val auditScroll = rememberScrollState()

  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    error?.let { ErrorCard(message = it) }

    HeaderCard(
      lead = l,
      mediatorName = mediators.firstOrNull { it.id == l.mediatorId }?.name,
      highPotential = l.isHighPotential == true,
      onToggleHighPotential = { next ->
        val now = java.time.Instant.now().toString()
        val note = if (next) "[WATCHLIST]: Marked high potential" else "[WATCHLIST]: Removed high potential"
        update(
          LeadUpdate(
            isHighPotential = next,
            notes = (l.notes + LeadNote(text = note, date = now, byUser = actor)).takeLast(500),
          ),
        )
      },
      onEdit = onEdit,
      onCall = {
        if (!l.phone.isNullOrBlank()) {
          context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${l.phone}")))
          appendNote("[CALL]: Dialed client")
        }
      },
      onWhatsApp = {
        if (!l.phone.isNullOrBlank()) {
          context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/${l.phone}")))
          appendNote("[WHATSAPP]: Opened chat")
        }
      },
    )

    TabRow(selectedTabIndex = selectedTab) {
      Tab(
        selected = selectedTab == 0,
        onClick = { selectedTab = 0 },
        text = { Text("Lead") },
      )
      Tab(
        selected = selectedTab == 1,
        onClick = { selectedTab = 1 },
        text = { Text("Audit") },
      )
    }

    if (selectedTab == 0) {
      Column(
        modifier = Modifier.fillMaxWidth().weight(1f, fill = true).verticalScroll(leadScroll),
        verticalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        Card(
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
          elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        ) {
          Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
              Text("Workflow", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
              if (pipelineBusy) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
              }
            }
            StatusPipelineBar(current = pipelineStage)
            pipelineError?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
          }
        }

        if (session.isAdmin) {
          val profilesById = remember(session.profiles) { session.profiles.associateBy { it.userId } }
          val ownerProfile = l.ownerId?.let { profilesById[it] }
          val ownerLabel =
            ownerProfile?.fullName?.takeIf { it.isNotBlank() }
              ?: ownerProfile?.email?.takeIf { it.isNotBlank() }
              ?: l.assignedStaff?.takeIf { it.isNotBlank() }
              ?: (l.ownerId?.takeIf { it.isNotBlank() } ?: "Unassigned")

          Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
          ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
              Text("Assigned to", style = MaterialTheme.typography.titleMedium)

              Column {
                OutlinedTextField(
                  value = ownerLabel,
                  onValueChange = {},
                  readOnly = true,
                  modifier = Modifier.fillMaxWidth(),
                  trailingIcon = {
                    IconButton(onClick = { assignExpanded = !assignExpanded }) {
                      Icon(Icons.Outlined.ArrowDropDown, contentDescription = null)
                    }
                  },
                  colors =
                    TextFieldDefaults.colors(
                      unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                      focusedContainerColor = MaterialTheme.colorScheme.surface,
                      focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
                      unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
                      focusedTextColor = MaterialTheme.colorScheme.onSurface,
                      unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                      focusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
                      unfocusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    ),
                )

                DropdownMenu(expanded = assignExpanded, onDismissRequest = { assignExpanded = false }) {
                  val myId = session.userId
                  if (!myId.isNullOrBlank()) {
                    DropdownMenuItem(
                      text = { Text("Assign to me") },
                      onClick = {
                        assignExpanded = false
                        val now = java.time.Instant.now().toString()
                        val me = profilesById[myId]
                        val meLabel =
                          me?.fullName?.takeIf { it.isNotBlank() }
                            ?: me?.email?.takeIf { it.isNotBlank() }
                            ?: "Me"
                        val note = "[ASSIGNED]: $meLabel"
                        update(
                          LeadUpdate(
                            ownerId = myId,
                            assignedStaff = meLabel,
                            notes = (l.notes + LeadNote(text = note, date = now, byUser = actor)).takeLast(500),
                          ),
                        )
                      },
                    )
                    Divider()
                  }

                  val options =
                    session.profiles
                      .filter { p -> myId.isNullOrBlank() || p.userId != myId }
                      .sortedBy { (it.fullName ?: it.email ?: it.userId).lowercase() }

                  if (options.isEmpty()) {
                    DropdownMenuItem(
                      text = { Text("No staff profiles found") },
                      onClick = { assignExpanded = false },
                    )
                  } else {
                    options.forEach { p ->
                      val label =
                        p.fullName?.takeIf { it.isNotBlank() }
                          ?: p.email?.takeIf { it.isNotBlank() }
                          ?: p.userId
                      val role =
                        p.role?.takeIf { it.isNotBlank() }
                          ?: "staff"
                      DropdownMenuItem(
                        text = { Text("$label • $role") },
                        onClick = {
                          assignExpanded = false
                          val now = java.time.Instant.now().toString()
                          val note = "[ASSIGNED]: $label"
                          update(
                            LeadUpdate(
                              ownerId = p.userId,
                              assignedStaff = label,
                              notes = (l.notes + LeadNote(text = note, date = now, byUser = actor)).takeLast(500),
                            ),
                          )
                        },
                      )
                    }
                  }
                }
              }
            }
          }
        }

    StatusFollowUpCard(
      lead = l,
      busy = busy,
      canOverrideStatus = session.isAdmin,
      onStatusSelected = { nextStatus ->
        val now = java.time.Instant.now().toString()
        val note = "[STATUS]: Changed to $nextStatus"
        update(
          LeadUpdate(
            status = nextStatus,
            notes = (l.notes + LeadNote(text = note, date = now, byUser = actor)).takeLast(500),
          ),
        )
      },
      onFollowUpSelected = { nextLocal ->
        val iso = nextLocal.atZone(KOLKATA_ZONE).toInstant().toString()
        val now = java.time.Instant.now().toString()
        val note = "[NEXT]: Set follow-up to ${nextLocal.toLocalDate()} ${nextLocal.toLocalTime()}"
        update(
          LeadUpdate(
            nextFollowUp = iso,
            notes = (l.notes + LeadNote(text = note, date = now, byUser = actor)).takeLast(500),
          ),
        )
      },
    )

    if ((l.status ?: "").equals("Payment Done", ignoreCase = true)) {
      LoanTermsCard(
        lead = l,
        busy = busy,
        onSave = { details, updateFollowUp ->
          val now = java.time.Instant.now().toString()
          val nextFollowUp =
            if (updateFollowUp) {
              val pay = isoToKolkataLocalDateTime(details.paymentDate)?.toLocalDate() ?: nowKolkataDate()
              val weeks = (details.tenure ?: 12).coerceAtLeast(1)
              val frequency = parseLoanFrequency(details.frequency)
              followUpAt50PctTerm(pay, weeks, frequency).atStartOfDay(KOLKATA_ZONE).toInstant().toString()
            } else {
              null
            }

          val note = "[TERMS]: Updated loan terms"
          update(
            LeadUpdate(
              loanAmount = details.principal,
              loanDetails = details,
              nextFollowUp = nextFollowUp,
              notes = (l.notes + LeadNote(text = note, date = now, byUser = actor)).takeLast(500),
            ),
          )
        },
      )
    }

    DocumentsCard(
      documents = l.documents ?: LeadDocuments(),
      onChange = { update(LeadUpdate(documents = it)) },
      busy = busy,
    )

    AttachmentsCard(
      items = attachments,
      loading = attachmentsLoading,
      busy = attachmentsBusy,
      error = attachmentsError,
      onPick = { pickAttachment.launch(arrayOf("*/*")) },
      onOpen = { obj ->
        val path = resolveObjectPath(obj)
        val fileName = resolveDisplayName(obj)
        scope.launch {
          attachmentsBusy = true
          attachmentsError = null
          runCatching {
            val bytes = leadsRepository.downloadLeadAttachment(path = path)
            val outDir = File(context.cacheDir, "attachments").apply { mkdirs() }
            val outFile = File(outDir, fileName)
            FileOutputStream(outFile).use { it.write(bytes) }

            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", outFile)
            val mime =
              URLConnection.guessContentTypeFromName(fileName)
                ?: "application/octet-stream"
            val intent =
              Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
              }
            context.startActivity(intent)
          }.onFailure { ex ->
            attachmentsError = ex.message ?: "Open failed."
          }
          attachmentsBusy = false
        }
      },
      onDelete = { obj ->
        val path = resolveObjectPath(obj)
        scope.launch {
          attachmentsBusy = true
          attachmentsError = null
          runCatching {
            leadsRepository.deleteLeadAttachment(path = path)
            appendNote("[ATTACHMENT]: Deleted ${resolveDisplayName(obj)}")
            refreshAttachments()
          }.onFailure { ex ->
            attachmentsError = ex.message ?: "Delete failed."
          }
          attachmentsBusy = false
        }
      },
    )

    NotesCard(
      notes = l.notes,
      value = addNoteText,
      onValueChange = { addNoteText = it },
      busy = busy,
      onSend = {
        val t = addNoteText.trim()
        if (t.isNotEmpty()) {
          appendNote(t)
          addNoteText = ""
        }
      },
    )

    QuickTriageCard(
      busy = busy,
      onPartnerFollowUp = {
        val now = java.time.Instant.now().toString()
        val next = nowKolkataDate().plusDays(3).atStartOfDay(KOLKATA_ZONE).toInstant().toString()
        update(
          LeadUpdate(
            status = "Partner Follow-Up",
            nextFollowUp = next,
            notes = (l.notes + LeadNote(text = "[Triage]: Partner follow-up requested", date = now, byUser = actor)).takeLast(500),
          ),
        )
      },
      onInterestIssue = {
        val now = java.time.Instant.now().toString()
        val next = nowKolkataDate().plusDays(15).atStartOfDay(KOLKATA_ZONE).toInstant().toString()
        update(
          LeadUpdate(
            status = "Interest Rate Issue",
            nextFollowUp = next,
            notes = (l.notes + LeadNote(text = "[Triage]: Interest rate issue", date = now, byUser = actor)).takeLast(500),
          ),
        )
      },
      onNoAppointment = {
        val now = java.time.Instant.now().toString()
        val next = nowKolkataDate().plusDays(5).atStartOfDay(KOLKATA_ZONE).toInstant().toString()
        update(
          LeadUpdate(
            status = "No Appointment",
            nextFollowUp = next,
            notes = (l.notes + LeadNote(text = "[Triage]: No appointment", date = now, byUser = actor)).takeLast(500),
          ),
        )
      },
      onCommercialVisit = { showCommercialVisit = true },
    )

    ActionGrid(
      busy = busy,
      onPaymentDone = { showPayment = true },
      onScheduleMeeting = { showMeeting = true },
      onFollowUp = { showFollowUp = true },
      onReject = { showReject = true },
      onDelete = { showDelete = true },
    )

    val isRejected =
      setOf("Not Eligible", "Not Reliable", "Lost to Competitor").contains((l.status ?: "").trim()) ||
        l.rejectionDetails != null
    if (isRejected) {
      Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("Rejection letter (PDF)", style = MaterialTheme.typography.titleMedium)
          Text(
            "Generate a professional rejection notice for audit/partner communication.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )

          rejectionPdfError?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
          }

          Button(
            onClick = { exportRejectionLetterPdf(l) },
            enabled = !rejectionPdfBusy,
            modifier = Modifier.fillMaxWidth(),
          ) {
            if (rejectionPdfBusy) {
              CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
              Spacer(Modifier.width(10.dp))
              Text("Generating…")
            } else {
              Text("Export rejection letter")
            }
          }
        }
      }
    }

    Spacer(Modifier.height(4.dp))
      }
    } else {
      Card(
        modifier = Modifier.fillMaxWidth().weight(1f, fill = true),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Column(modifier = Modifier.fillMaxWidth().verticalScroll(auditScroll).padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
          Text("Audit trail", style = MaterialTheme.typography.titleMedium)
          Text(
            "Read-only history for internal tracking (based on lead notes + system milestones).",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )

          val createdLabel =
            l.createdAt?.let { isoToKolkataLocalDateTime(it)?.toString() ?: it }
              ?.takeIf { it.isNotBlank() }
          if (createdLabel != null) {
            Card(
              colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
              border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
              elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            ) {
              Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Created", style = MaterialTheme.typography.labelLarge)
                Text(createdLabel, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                val who = (l.createdBy ?: l.ownerId).orEmpty().ifBlank { "—" }
                Text("By: $who", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              }
            }
          }

          if (!latestUwAppId.isNullOrBlank()) {
            Card(
              colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
              border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
              elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            ) {
              Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Underwriting", style = MaterialTheme.typography.labelLarge)
                Text("Latest UW: ${latestUwAppId!!.take(8)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                pdStatus?.takeIf { it.isNotBlank() }?.let { Text("PD: $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
              }
            }
          }

          val reversed = remember(l.notes) { l.notes.asReversed().take(250) }
          if (reversed.isEmpty()) {
            Text("No activity yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
          } else {
            reversed.forEach { n ->
              val whenLabel = isoToKolkataLocalDateTime(n.date)?.toString() ?: n.date
              val who = n.byUser?.takeIf { it.isNotBlank() } ?: "system"
              Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
              ) {
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                  Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(who, style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
                    Text(whenLabel, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                  }
                  Text(n.text, style = MaterialTheme.typography.bodyMedium)
                }
              }
            }
          }
        }
      }
    }
  }

  if (showDelete) {
    AlertDialog(
      onDismissRequest = { showDelete = false },
      title = { Text("Delete lead?") },
      text = { Text("This cannot be undone.") },
      confirmButton = {
        TextButton(
          onClick = {
            showDelete = false
            scope.launch {
              busy = true
              runCatching { leadsRepository.deleteLead(l.id) }
                .onFailure { error = it.message ?: "Delete failed." }
                .onSuccess {
                  onMutated()
                  onDeleted()
                }
              busy = false
            }
          },
        ) {
          Text("Delete", color = MaterialTheme.colorScheme.error)
        }
      },
      dismissButton = { TextButton(onClick = { showDelete = false }) { Text("Cancel") } },
    )
  }

  if (showPayment) {
    PaymentDoneDialog(
      onDismiss = { showPayment = false },
      onConfirm = { givenAmount, interest, commission, weeks, frequency ->
        showPayment = false
        val principal = (givenAmount + interest).coerceAtLeast(0L)
        val rateValue = calculateInterestRatePercent(givenAmount.toDouble(), interest.toDouble(), weeks.toDouble(), frequency)
        val rate = String.format("%.2f", rateValue)

        val followUpDate = followUpAt50PctTerm(nowKolkataDate(), weeks, frequency)
        val followUp = followUpDate.atStartOfDay(KOLKATA_ZONE).toInstant().toString()

        val details =
          LoanDetails(
            principal = principal,
            interest = interest,
            // Business rule: Net cash out is Principal (= Given + Upfront interest).
            // Do not treat given amount as principal; principal is computed.
            netDisbursed = principal,
            tenure = weeks,
            frequency = frequency.label,
            rate = rate,
            paymentDate = java.time.Instant.now().toString(),
            commissionAmount = commission,
          )

        val note =
          "[PAYMENT DONE]: Given ₹$givenAmount. Upfront Interest ₹$interest. Principal ₹$principal. Net Cash Out ₹$principal. Terms: ${formatTenureShort(weeks, frequency)} (${frequency.label}) @ $rate% rate. Comm: ₹$commission. Follow-up set for 50% term."

        update(
          LeadUpdate(
            status = "Payment Done",
            loanAmount = principal,
            loanDetails = details,
            nextFollowUp = followUp,
            notes = (l.notes + LeadNote(text = note, date = java.time.Instant.now().toString(), byUser = actor)).takeLast(500),
          ),
        )
      },
    )
  }

  if (showMeeting) {
    MeetingDialog(
      onDismiss = { showMeeting = false },
      onConfirm = { scheduled, addToCalendar ->
        showMeeting = false
        val iso = scheduled.atZone(KOLKATA_ZONE).toInstant().toString()
        update(
          LeadUpdate(
            status = "Meeting Scheduled",
            nextFollowUp = iso,
            notes = (l.notes + LeadNote(text = "[Triage]: Meeting Scheduled", date = java.time.Instant.now().toString(), byUser = actor)).takeLast(500),
          ),
        )
        if (addToCalendar) {
          val start = scheduled.atZone(KOLKATA_ZONE).toInstant().toEpochMilli()
          val end = start + 60 * 60 * 1000L
          val title = "Meeting: ${l.name}"
	          val desc =
	            buildString {
	              if (!l.company.isNullOrBlank()) append("Company: ${l.company}\n")
	              if (!l.location.isNullOrBlank()) append("Location: ${l.location}\n")
	              if (!l.phone.isNullOrBlank()) append("Phone: ${l.phone}\n")
	              val amt = l.loanAmount
	              if (amt != null && amt > 0L) append("Amount: ${formatCompactInr(amt)}\n")
	              append("Status: Meeting Scheduled\n")
	              append("Lead ID: ${l.id}\n")
	            }.trim()

          val intent =
            Intent(Intent.ACTION_INSERT)
              .setData(CalendarContract.Events.CONTENT_URI)
              .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
              .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end)
              .putExtra(CalendarContract.Events.TITLE, title)
              .putExtra(CalendarContract.Events.DESCRIPTION, desc)
          runCatching { context.startActivity(intent) }
        }
      },
    )
  }

  if (showFollowUp) {
    FollowUpDialog(
      onDismiss = { showFollowUp = false },
      onConfirm = { remark, nextDate ->
        showFollowUp = false
        val next = nextDate.atStartOfDay(KOLKATA_ZONE).toInstant().toString()
        val note = "[Follow-Up Update]: $remark"
        update(
          LeadUpdate(
            status = "Follow-Up Required",
            nextFollowUp = next,
            notes = (l.notes + LeadNote(text = note, date = java.time.Instant.now().toString(), byUser = actor)).takeLast(500),
          ),
        )
      },
    )
  }

  if (showReject) {
    RejectDialog(
      onDismiss = { showReject = false },
      onConfirm = { strategy, reason, defense, competitor ->
        showReject = false
        val now = java.time.Instant.now().toString()
        val newStatus =
          when (strategy) {
            "Competitor" -> "Lost to Competitor"
            "Client" -> "Not Interested (Temp)"
            else -> "Not Eligible"
          }

        val rej =
          RejectionDetails(
            strategy = strategy,
            reason = reason,
            competitor = competitor,
            defense = defense,
            date = now,
          )

        val note = "[REJECTION]: Strategy=$strategy | Reason=$reason"
        update(
          LeadUpdate(
            status = newStatus,
            rejectionDetails = rej,
            notes = (l.notes + LeadNote(text = note, date = now, byUser = actor)).takeLast(500),
          ),
        )
      },
    )
  }

  if (showCommercialVisit) {
    CommercialVisitDialog(
      initialDate = nowKolkataDate().plusDays(7),
      onDismiss = { showCommercialVisit = false },
      onConfirm = { remark, nextDate, collected, contact ->
        showCommercialVisit = false
        val now = java.time.Instant.now().toString()
        val nextIso = nextDate.atStartOfDay(KOLKATA_ZONE).toInstant().toString()
        val notes = buildList {
          add(LeadNote(text = "[Commercial Visit]: ${remark.ifBlank { "Visit completed" }}", date = now, byUser = actor))
          if (collected && contact.isNotBlank()) add(LeadNote(text = "[MEDIATOR COLLECTED]: $contact", date = now, byUser = actor))
        }
        update(
          LeadUpdate(
            status = "Commercial Client",
            nextFollowUp = nextIso,
            notes = (l.notes + notes).takeLast(500),
          ),
        )
      },
    )
  }
}

@Composable
private fun HeaderCard(
  lead: Lead,
  mediatorName: String?,
  highPotential: Boolean,
  onToggleHighPotential: (Boolean) -> Unit,
  onEdit: () -> Unit,
  onCall: () -> Unit,
  onWhatsApp: () -> Unit,
) {
  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text(lead.name, style = MaterialTheme.typography.headlineSmall)
          val sub =
            listOfNotNull(
                lead.company?.takeIf { it.isNotBlank() },
                lead.location?.takeIf { it.isNotBlank() },
              )
              .joinToString(" • ")
          if (sub.isNotBlank()) {
            Text(sub, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
          val med = mediatorName?.takeIf { it.isNotBlank() }.orEmpty()
          if (med.isNotBlank()) {
            Text("Mediator: $med", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }

        IconButton(onClick = { onToggleHighPotential(!highPotential) }) {
          Icon(
            if (highPotential) Icons.Outlined.Star else Icons.Outlined.StarBorder,
            contentDescription = "High potential",
            tint = if (highPotential) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
        IconButton(onClick = onEdit) { Icon(Icons.Outlined.Edit, contentDescription = "Edit") }
      }

      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        LeadStatusPill(status = lead.status)
        val amt = lead.loanAmount ?: 0L
        if (amt > 0) {
          Text(formatCompactInr(amt), style = MaterialTheme.typography.titleMedium)
        }
      }

      val next = lead.nextFollowUp?.let(::formatShortDate).orEmpty()
      if (next.isNotBlank()) {
        Text("Next follow-up: $next", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        if (!lead.phone.isNullOrBlank()) {
          Button(onClick = onCall) {
            Icon(Icons.Outlined.Phone, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Call")
          }
          Button(onClick = onWhatsApp) {
            Icon(Icons.Outlined.Chat, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("WhatsApp")
          }
        }
      }
    }
  }
}

@Composable
private fun StatusFollowUpCard(
  lead: Lead,
  busy: Boolean,
  canOverrideStatus: Boolean,
  onStatusSelected: (String) -> Unit,
  onFollowUpSelected: (LocalDateTime) -> Unit,
) {
  val context = LocalContext.current
  var statusExpanded by remember { mutableStateOf(false) }
  var overrideOpen by remember { mutableStateOf(false) }

  // Fix: Some OEMs/styles render readOnly fields with disabled colors.
  // Keep the field readable and "banking clean" (avoid dark fills in light mode).
  val statusFieldColors =
    TextFieldDefaults.colors(
      unfocusedContainerColor = MaterialTheme.colorScheme.surface,
      focusedContainerColor = MaterialTheme.colorScheme.surface,
      disabledContainerColor = MaterialTheme.colorScheme.surface,
      focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
      unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
      disabledIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
      focusedTextColor = MaterialTheme.colorScheme.onSurface,
      unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
      disabledTextColor = MaterialTheme.colorScheme.onSurface,
      focusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
      unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
      disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
      focusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
      unfocusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
      disabledPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
    )

  val statuses =
    remember {
      listOf(
        "New",
        "Meeting Scheduled",
        "Follow-Up Required",
        "Partner Follow-Up",
        "Statements Not Received",
        "Contact Details Not Received",
        "Interest Rate Issue",
        "Commercial Client",
        "Payment Done",
        "Deal Closed",
        "No Appointment",
        "Lost to Competitor",
        "Not Eligible",
        "Not Reliable",
        "Not Interested (Temp)",
      )
    }

  val currentStatus = (lead.status ?: "New").ifBlank { "New" }
  val currentFollowUp = isoToKolkataLocalDateTime(lead.nextFollowUp) ?: LocalDateTime.now(KOLKATA_ZONE).withSecond(0).withNano(0)

  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Text("Status & next action", style = MaterialTheme.typography.titleMedium)
      Text(
        "Use the action buttons below (Meeting / Follow-up / Payment / Reject) for status changes so updates follow the right flow.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )

      OutlinedTextField(
        value = currentStatus,
        onValueChange = {},
        readOnly = true,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Status") },
        colors = statusFieldColors,
      )

      OutlinedButton(
        onClick = {
          showDatePicker(context = context, initial = currentFollowUp.toLocalDate()) { d ->
            showTimePicker(context = context, initial = currentFollowUp.toLocalTime()) { t ->
              onFollowUpSelected(LocalDateTime.of(d, t))
            }
          }
        },
        enabled = !busy,
        modifier = Modifier.fillMaxWidth(),
      ) {
        Icon(Icons.Outlined.CalendarMonth, contentDescription = null)
        Spacer(Modifier.width(8.dp))
        Text("Set next follow-up (${currentFollowUp.toLocalDate()} ${currentFollowUp.toLocalTime()})")
      }

      if (canOverrideStatus) {
        TextButton(
          onClick = { overrideOpen = !overrideOpen },
          enabled = !busy,
          modifier = Modifier.fillMaxWidth(),
        ) {
          Text(if (overrideOpen) "Hide manual override" else "Manual override (admin)")
        }

        if (overrideOpen) {
          Column {
            OutlinedTextField(
              value = currentStatus,
              onValueChange = {},
              readOnly = true,
              modifier = Modifier.fillMaxWidth(),
              label = { Text("Change status") },
              trailingIcon = {
                IconButton(onClick = { statusExpanded = !statusExpanded }, enabled = !busy) {
                  Icon(Icons.Outlined.ArrowDropDown, contentDescription = null)
                }
              },
              colors = statusFieldColors,
            )

            DropdownMenu(expanded = statusExpanded, onDismissRequest = { statusExpanded = false }) {
              statuses.forEach { s ->
                DropdownMenuItem(
                  text = { Text(s) },
                  onClick = {
                    statusExpanded = false
                    onStatusSelected(s)
                  },
                )
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun LoanTermsCard(
  lead: Lead,
  busy: Boolean,
  onSave: (LoanDetails, updateFollowUpTo50Pct: Boolean) -> Unit,
) {
  val current = lead.loanDetails ?: LoanDetails(principal = lead.loanAmount)
  val existingPrincipal = current.principal ?: lead.loanAmount ?: 0L
  val existingInterest = current.interest ?: 0L
  val existingNet = current.netDisbursed
  // Backward compatible default:
  // - old logic stored netDisbursed = principal - interest (smaller than principal)
  // - new logic stores netDisbursed = principal (same as principal)
  val defaultGivenAmount =
    when {
      existingNet != null && existingNet in 0L until existingPrincipal -> existingNet
      else -> (existingPrincipal - existingInterest).coerceAtLeast(0L)
    }

  var givenAmount by remember { mutableStateOf(defaultGivenAmount.toString()) }
  var interest by remember { mutableStateOf(existingInterest.toString()) }
  var commission by remember { mutableStateOf((current.commissionAmount ?: 0L).toString()) }
  var tenure by remember { mutableStateOf((current.tenure ?: 12).toString()) }
  var paymentDate by remember { mutableStateOf(current.paymentDate ?: java.time.Instant.now().toString()) }
  var updateFollowUp by remember { mutableStateOf(true) }
  var frequency by remember { mutableStateOf(parseLoanFrequency(current.frequency)) }

  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Text("Loan terms", style = MaterialTheme.typography.titleMedium)

      val tfColors =
        TextFieldDefaults.colors(
          unfocusedContainerColor = MaterialTheme.colorScheme.surface,
          focusedContainerColor = MaterialTheme.colorScheme.surface,
          focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
          unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
          focusedTextColor = MaterialTheme.colorScheme.onSurface,
          unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
      )

      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        LoanFrequency.entries.forEach { f ->
          FilterChip(
            selected = frequency == f,
            onClick = { frequency = f },
            label = { Text(f.label) },
            colors =
              FilterChipDefaults.filterChipColors(
                selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
                selectedLabelColor = MaterialTheme.colorScheme.onBackground,
              ),
            border =
              FilterChipDefaults.filterChipBorder(
                enabled = true,
                selected = frequency == f,
                borderColor = MaterialTheme.colorScheme.outlineVariant,
                selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
              ),
          )
        }
      }

      OutlinedTextField(
        value = givenAmount,
        onValueChange = { givenAmount = it },
        label = { Text("Given amount") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        colors = tfColors,
      )
      OutlinedTextField(
        value = interest,
        onValueChange = { interest = it },
        label = { Text("Interest") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        colors = tfColors,
      )

      val computedPrincipal =
        remember(givenAmount, interest) {
          val g = givenAmount.trim().toLongOrNull() ?: 0L
          val i = interest.trim().toLongOrNull() ?: 0L
          (g + i).coerceAtLeast(0L)
        }
      Text(
        "Principal (Given + interest): ₹$computedPrincipal",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      OutlinedTextField(
        value = commission,
        onValueChange = { commission = it },
        label = { Text("Commission") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        colors = tfColors,
      )
      OutlinedTextField(
        value = tenure,
        onValueChange = { tenure = it },
        label = { Text(frequencyTenureLabel(frequency)) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        colors = tfColors,
      )
      OutlinedTextField(
        value = paymentDate.take(10),
        onValueChange = {},
        readOnly = true,
        label = { Text("Payment date") },
        trailingIcon = {
          Icon(Icons.Outlined.CalendarMonth, contentDescription = null)
        },
        colors = tfColors,
      )

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        androidx.compose.material3.Checkbox(checked = updateFollowUp, onCheckedChange = { updateFollowUp = it }, enabled = !busy)
        Text("Update next follow-up to 50% term", style = MaterialTheme.typography.bodyMedium)
      }

      Button(
        onClick = {
          val g = givenAmount.trim().toLongOrNull() ?: 0L
          val i = interest.trim().toLongOrNull() ?: 0L
          val c = commission.trim().toLongOrNull() ?: 0L
          val m = tenure.trim().toIntOrNull()?.coerceAtLeast(1) ?: 12
          val p = (g + i).coerceAtLeast(0L)
          val rateValue = calculateInterestRatePercent(given = g.toDouble(), interest = i.toDouble(), weeks = m.toDouble(), frequency = frequency)
          val rate = String.format("%.2f", rateValue)

          onSave(
            LoanDetails(
              principal = p,
              interest = i,
              // Business rule: Net cash out is Principal (= Given + Upfront interest).
              netDisbursed = p,
              tenure = m,
              frequency = frequency.label,
              rate = rate,
              paymentDate = paymentDate,
              commissionAmount = c,
            ),
            updateFollowUp,
          )
        },
        enabled = !busy,
        modifier = Modifier.fillMaxWidth(),
      ) {
        Text("Save terms")
      }
    }
  }
}

@Composable
private fun DocumentsCard(
  documents: LeadDocuments,
  onChange: (LeadDocuments) -> Unit,
  busy: Boolean,
) {
  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Text("Documents", style = MaterialTheme.typography.titleMedium)
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        DocToggle(label = "KYC", checked = documents.kyc, enabled = !busy) { onChange(documents.copy(kyc = it)) }
        DocToggle(label = "ITR", checked = documents.itr, enabled = !busy) { onChange(documents.copy(itr = it)) }
        DocToggle(label = "Bank", checked = documents.bank, enabled = !busy) { onChange(documents.copy(bank = it)) }
      }
    }
  }
}

@Composable
private fun AttachmentsCard(
  items: List<StorageObject>,
  loading: Boolean,
  busy: Boolean,
  error: String?,
  onPick: () -> Unit,
  onOpen: (StorageObject) -> Unit,
  onDelete: (StorageObject) -> Unit,
) {
  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text("Attachments", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        Button(onClick = onPick, enabled = !busy) {
          Icon(Icons.Outlined.AttachFile, contentDescription = null)
          Spacer(Modifier.width(8.dp))
          Text("Upload")
        }
      }

      error?.takeIf { it.isNotBlank() }?.let { msg ->
        Text(msg, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
      }

      if (loading) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
          Text("Loading…", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      } else if (items.isEmpty()) {
        Text("No attachments yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      } else {
        items.take(25).forEach { obj ->
          val name = obj.name.substringAfterLast('/').ifBlank { obj.name }
          Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
          ) {
            Row(
              modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
              Icon(Icons.Outlined.AttachFile, contentDescription = null)
              Text(name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f), maxLines = 1)
              IconButton(onClick = { onOpen(obj) }, enabled = !busy) {
                Icon(Icons.Outlined.OpenInNew, contentDescription = "Open")
              }
              IconButton(onClick = { onDelete(obj) }, enabled = !busy) {
                Icon(Icons.Outlined.DeleteOutline, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
              }
            }
          }
        }
        if (items.size > 25) {
          Text(
            "Showing first 25 of ${items.size}.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }
    }
  }
}

@Composable
private fun DocToggle(
  label: String,
  checked: Boolean,
  enabled: Boolean,
  onChange: (Boolean) -> Unit,
) {
  val contentColor = MaterialTheme.colorScheme.onSurface
  Card(
    colors =
      CardDefaults.cardColors(
          containerColor =
            if (checked) MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f) else MaterialTheme.colorScheme.surface,
          contentColor = contentColor,
      ),
    border =
      BorderStroke(
        1.dp,
        if (checked) MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f) else MaterialTheme.colorScheme.outlineVariant,
      ),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    modifier = Modifier,
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      androidx.compose.material3.Checkbox(
        checked = checked,
        onCheckedChange = if (enabled) onChange else null,
        colors =
          androidx.compose.material3.CheckboxDefaults.colors(
            checkedColor = MaterialTheme.colorScheme.secondary,
            checkmarkColor = MaterialTheme.colorScheme.onSecondary,
            uncheckedColor = MaterialTheme.colorScheme.outline,
            disabledCheckedColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
            disabledUncheckedColor = MaterialTheme.colorScheme.outlineVariant,
            disabledIndeterminateColor = MaterialTheme.colorScheme.outlineVariant,
          ),
      )
      Text(label, style = MaterialTheme.typography.bodyMedium, color = contentColor)
    }
  }
}

@Composable
private fun NotesCard(
  notes: List<LeadNote>,
  value: String,
  onValueChange: (String) -> Unit,
  busy: Boolean,
  onSend: () -> Unit,
) {
  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Text("Activity log", style = MaterialTheme.typography.titleMedium)

      if (notes.isEmpty()) {
        Text("No notes yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      } else {
        notes.takeLast(20).asReversed().forEach { n ->
          Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
          ) {
            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
              Text(n.text, style = MaterialTheme.typography.bodyMedium)
              Text(formatShortDate(n.date), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
          }
        }
      }

      Divider()

      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(
          value = value,
          onValueChange = onValueChange,
          modifier = Modifier.weight(1f),
          singleLine = true,
          placeholder = { Text("Add note…") },
          colors =
            TextFieldDefaults.colors(
              unfocusedContainerColor = MaterialTheme.colorScheme.surface,
              focusedContainerColor = MaterialTheme.colorScheme.surface,
              disabledContainerColor = MaterialTheme.colorScheme.surface,
              focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
              unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
              disabledIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
              focusedTextColor = MaterialTheme.colorScheme.onSurface,
              unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
              disabledTextColor = MaterialTheme.colorScheme.onSurface,
              focusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
              unfocusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
              disabledPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
            ),
        )
        IconButton(onClick = onSend, enabled = !busy) {
          Icon(Icons.Outlined.Send, contentDescription = "Send")
        }
      }
    }
  }
}

@Composable
private fun ActionGrid(
  busy: Boolean,
  onPaymentDone: () -> Unit,
  onScheduleMeeting: () -> Unit,
  onFollowUp: () -> Unit,
  onReject: () -> Unit,
  onDelete: () -> Unit,
) {
  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("Actions", style = MaterialTheme.typography.titleMedium)
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        Button(onClick = onPaymentDone, enabled = !busy, modifier = Modifier.weight(1f)) {
          Icon(Icons.Outlined.CheckCircle, contentDescription = null)
          Spacer(Modifier.width(8.dp))
          Text("Payment")
        }
        Button(onClick = onScheduleMeeting, enabled = !busy, modifier = Modifier.weight(1f)) {
          Icon(Icons.Outlined.CalendarMonth, contentDescription = null)
          Spacer(Modifier.width(8.dp))
          Text("Meeting")
        }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        Button(onClick = onFollowUp, enabled = !busy, modifier = Modifier.weight(1f)) {
          Icon(Icons.Outlined.Save, contentDescription = null)
          Spacer(Modifier.width(8.dp))
          Text("Follow-up")
        }
        Button(onClick = onReject, enabled = !busy, modifier = Modifier.weight(1f)) {
          Icon(Icons.Outlined.Block, contentDescription = null)
          Spacer(Modifier.width(8.dp))
          Text("Reject")
        }
      }
      TextButton(onClick = onDelete, enabled = !busy) {
        Icon(Icons.Outlined.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error)
        Spacer(Modifier.width(8.dp))
        Text("Delete lead", color = MaterialTheme.colorScheme.error)
      }
    }
  }
}

@Composable
private fun QuickTriageCard(
  busy: Boolean,
  onPartnerFollowUp: () -> Unit,
  onInterestIssue: () -> Unit,
  onNoAppointment: () -> Unit,
  onCommercialVisit: () -> Unit,
) {
  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("Quick triage", style = MaterialTheme.typography.titleMedium)

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        Button(onClick = onPartnerFollowUp, enabled = !busy, modifier = Modifier.weight(1f)) { Text("Partner FU") }
        Button(onClick = onInterestIssue, enabled = !busy, modifier = Modifier.weight(1f)) { Text("Rate issue") }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        Button(onClick = onNoAppointment, enabled = !busy, modifier = Modifier.weight(1f)) { Text("No appt") }
        Button(onClick = onCommercialVisit, enabled = !busy, modifier = Modifier.weight(1f)) { Text("Commercial") }
      }
    }
  }
}

@Composable
private fun CommercialVisitDialog(
  initialDate: LocalDate,
  onDismiss: () -> Unit,
  onConfirm: (remark: String, nextDate: LocalDate, collectedMediator: Boolean, mediatorContact: String) -> Unit,
) {
  val context = LocalContext.current
  var remark by remember { mutableStateOf("") }
  var nextDate by remember { mutableStateOf(initialDate) }
  var collected by remember { mutableStateOf(false) }
  var contact by remember { mutableStateOf("") }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Commercial visit") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(
          value = remark,
          onValueChange = { remark = it },
          label = { Text("Remark (optional)") },
          colors =
            TextFieldDefaults.colors(
              unfocusedContainerColor = MaterialTheme.colorScheme.surface,
              focusedContainerColor = MaterialTheme.colorScheme.surface,
              focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
              unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
              focusedTextColor = MaterialTheme.colorScheme.onSurface,
              unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
            ),
        )

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
          androidx.compose.material3.Checkbox(checked = collected, onCheckedChange = { collected = it })
          Text("Collected new mediator contact")
        }
        if (collected) {
          OutlinedTextField(
            value = contact,
            onValueChange = { contact = it },
            label = { Text("Mediator contact (name + phone)") },
            colors =
              TextFieldDefaults.colors(
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
                unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
                focusedTextColor = MaterialTheme.colorScheme.onSurface,
                unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
              ),
          )
        }

        OutlinedButton(
          onClick = { showDatePicker(context = context, initial = nextDate) { d -> nextDate = d } },
          modifier = Modifier.fillMaxWidth(),
        ) {
          Icon(Icons.Outlined.CalendarMonth, contentDescription = null)
          Spacer(Modifier.width(8.dp))
          Text("Next follow-up: $nextDate")
        }
      }
    },
    confirmButton = {
      TextButton(onClick = { onConfirm(remark.trim(), nextDate, collected, contact.trim()) }) { Text("Save") }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
  )
}

@Composable
private fun ErrorCard(message: String) {
  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
  ) {
    Text(
      message,
      modifier = Modifier.padding(12.dp),
      color = MaterialTheme.colorScheme.error,
      style = MaterialTheme.typography.bodyMedium,
    )
  }
}

@Composable
private fun PaymentDoneDialog(
  onDismiss: () -> Unit,
  onConfirm: (givenAmount: Long, interest: Long, commission: Long, weeks: Int, frequency: LoanFrequency) -> Unit,
) {
  var givenAmount by remember { mutableStateOf("100000") }
  var interest by remember { mutableStateOf("10000") }
  var commission by remember { mutableStateOf("0") }
  var weeks by remember { mutableStateOf("12") }
  var frequency by remember { mutableStateOf(LoanFrequency.Monthly) }

  val computedPrincipal =
    remember(givenAmount, interest) {
      val g = givenAmount.trim().toLongOrNull() ?: 0L
      val i = interest.trim().toLongOrNull() ?: 0L
      (g + i).coerceAtLeast(0L)
    }

  val rateValue =
    remember(givenAmount, interest, weeks, frequency) {
      val given = givenAmount.trim().toDoubleOrNull() ?: 0.0
      val interestNum = interest.trim().toDoubleOrNull() ?: 0.0
      val weeksNum = weeks.trim().toDoubleOrNull() ?: 0.0
      calculateInterestRatePercent(given = given, interest = interestNum, weeks = weeksNum, frequency = frequency)
    }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Payment done") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
          LoanFrequency.entries.forEach { f ->
            FilterChip(
              selected = frequency == f,
              onClick = { frequency = f },
              label = { Text(f.label) },
              colors =
                FilterChipDefaults.filterChipColors(
                  selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
                  selectedLabelColor = MaterialTheme.colorScheme.onBackground,
                ),
              border =
                FilterChipDefaults.filterChipBorder(
                  enabled = true,
                  selected = frequency == f,
                  borderColor = MaterialTheme.colorScheme.outlineVariant,
                  selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
                ),
            )
          }
        }

        OutlinedTextField(
          value = givenAmount,
          onValueChange = { givenAmount = it },
          label = { Text("Given amount (₹)") },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        OutlinedTextField(
          value = interest,
          onValueChange = { interest = it },
          label = { Text("Upfront interest (₹)") },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        OutlinedTextField(
          value = commission,
          onValueChange = { commission = it },
          label = { Text("Commission (₹)") },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        OutlinedTextField(
          value = weeks,
          onValueChange = { weeks = it },
          label = { Text(frequencyTenureLabel(frequency)) },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        Text(
          "Principal (Given + interest): ₹$computedPrincipal",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
          "Our interest rate: ${String.format("%.2f", rateValue)}%",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    },
    confirmButton = {
      TextButton(
        onClick = {
          val g = givenAmount.toLongOrNull() ?: 0L
          val i = interest.toLongOrNull() ?: 0L
          val c = commission.toLongOrNull() ?: 0L
          val w = weeks.toIntOrNull() ?: 0
          onConfirm(g, i, c, w, frequency)
        },
      ) {
        Text("Confirm")
      }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
  )
}

@Composable
private fun MeetingDialog(
  onDismiss: () -> Unit,
  onConfirm: (LocalDateTime, addToCalendar: Boolean) -> Unit,
) {
  val context = LocalContext.current
  var date by remember { mutableStateOf(LocalDate.now()) }
  var time by remember { mutableStateOf(LocalTime.of(11, 0)) }
  var addToCalendar by remember { mutableStateOf(true) }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Schedule meeting") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(onClick = { showDatePicker(context, date) { date = it } }) { Text("Pick date: $date") }
        Button(onClick = { showTimePicker(context, time) { time = it } }) { Text("Pick time: $time") }
        Text("Selected: ${date} ${time}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          androidx.compose.material3.Checkbox(checked = addToCalendar, onCheckedChange = { addToCalendar = it })
          Text("Add to calendar", style = MaterialTheme.typography.bodyMedium)
        }
      }
    },
    confirmButton = { TextButton(onClick = { onConfirm(LocalDateTime.of(date, time), addToCalendar) }) { Text("Save") } },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
  )
}

@Composable
private fun FollowUpDialog(
  onDismiss: () -> Unit,
  onConfirm: (remark: String, nextDate: LocalDate) -> Unit,
) {
  val context = LocalContext.current
  var remark by remember { mutableStateOf("") }
  var date by remember { mutableStateOf(LocalDate.now().plusDays(1)) }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Follow-up update") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(value = remark, onValueChange = { remark = it }, label = { Text("Remark") })
        Button(onClick = { showDatePicker(context, date) { date = it } }) { Text("Next date: $date") }
      }
    },
    confirmButton = { TextButton(onClick = { onConfirm(remark.trim(), date) }) { Text("Save") } },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
  )
}

@Composable
private fun RejectDialog(
  onDismiss: () -> Unit,
  onConfirm: (strategy: String, reason: String, defense: String?, competitor: String?) -> Unit,
) {
  var strategy by remember { mutableStateOf("Risk") }
  var reason by remember { mutableStateOf("") }
  var defense by remember { mutableStateOf("") }
  var competitor by remember { mutableStateOf("") }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Reject strategy") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(value = strategy, onValueChange = { strategy = it }, label = { Text("Strategy (Risk / Competitor / Internal / Client)") })
        OutlinedTextField(value = reason, onValueChange = { reason = it }, label = { Text("Root cause") })
        OutlinedTextField(value = competitor, onValueChange = { competitor = it }, label = { Text("Competitor (optional)") })
        OutlinedTextField(value = defense, onValueChange = { defense = it }, label = { Text("Defense / justification (optional)") })
      }
    },
    confirmButton = {
      TextButton(
        onClick = {
          onConfirm(strategy.trim(), reason.trim(), defense.trim().takeIf { it.isNotBlank() }, competitor.trim().takeIf { it.isNotBlank() })
        },
      ) {
        Text("Confirm")
      }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
  )
}

private fun computePipelineStage(
  leadStatus: String?,
  hasUnderwriting: Boolean,
  pdStarted: Boolean,
  pdCompleted: Boolean,
): PipelineStage {
  val s = leadStatus?.trim().orEmpty()
  val isLoan = s == "Payment Done" || s == "Deal Closed"
  if (isLoan) return PipelineStage.Loan
  if (pdCompleted) return PipelineStage.Approval
  if (pdStarted) return PipelineStage.PD
  if (hasUnderwriting) return PipelineStage.Underwriting
  return PipelineStage.Lead
}
