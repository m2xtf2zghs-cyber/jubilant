package com.jubilant.lirasnative.shared.supabase

import com.jubilant.lirasnative.shared.SessionStorage
import com.jubilant.lirasnative.shared.http.createHttpClient
import com.jubilant.lirasnative.shared.util.DefaultJson
import io.ktor.client.call.body
import io.ktor.client.plugins.ClientRequestException
import io.ktor.client.request.accept
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.patch
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.URLBuilder
import io.ktor.http.appendPathSegments
import io.ktor.http.parameters
import io.ktor.utils.io.errors.IOException
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlinx.datetime.Clock
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

data class SupabaseConfig(
  val url: String,
  val anonKey: String,
)

class SupabaseClient(
  private val config: SupabaseConfig,
  private val storage: SessionStorage,
) {
  private val http = createHttpClient()
  private val baseUrl = normalizeSupabaseUrl(config.url)
  private val attachmentsBucket = "liras-attachments"

  fun isConfigured(): Boolean = baseUrl.isNotBlank() && config.anonKey.isNotBlank()

  @Throws(Exception::class)
  suspend fun restoreSession(): SupabaseSession? = storage.load()

  @Throws(Exception::class)
  suspend fun clearSession() {
    storage.clear()
  }

  @Throws(Exception::class)
  suspend fun requireUserId(): String {
    val session = requireNotNull(storage.load()) { "Not signed in." }
    return session.user?.id ?: decodeJwtSub(session.accessToken) ?: error("Missing user id in session.")
  }

  @Throws(Exception::class)
  suspend fun getMyProfile(): Profile? {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()
    return getProfile(userId)
  }

  @Throws(Exception::class)
  suspend fun getProfile(userId: String): Profile? {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "profiles")
        parameters.append("select", "user_id,email,full_name,role,created_at,updated_at")
        parameters.append("user_id", "eq.$userId")
        parameters.append("limit", "1")
      }.buildString()

      val items: List<Profile> =
        http.get(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          accept(ContentType.Application.Json)
        }.body()

      items.firstOrNull()
    }
  }

  @Throws(Exception::class)
  suspend fun listProfiles(limit: Int = 200): List<Profile> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "profiles")
        parameters.append("select", "user_id,email,full_name,role,created_at,updated_at")
        parameters.append("order", "updated_at.desc")
        parameters.append("limit", limit.toString())
      }.buildString()

      http.get(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }.body()
    }
  }

  @Throws(Exception::class)
  suspend fun updateProfile(userId: String, patch: ProfileUpdate): Profile {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "profiles")
        parameters.append("user_id", "eq.$userId")
      }.buildString()

      val updated: List<Profile> =
        http.patch(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(patch)
        }.body()

      updated.firstOrNull() ?: error("Update failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun upsertProfile(userId: String, email: String?, fullName: String?, role: String?): Profile {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "profiles")
        parameters.append("on_conflict", "user_id")
      }.buildString()

      val body =
        buildJsonObject {
          put("user_id", userId)
          putOrNull("email", email)
          putOrNull("full_name", fullName)
          putOrNull("role", role)
        }

      val updated: List<Profile> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation,resolution=merge-duplicates")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      updated.firstOrNull() ?: error("Upsert failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun signInWithPassword(email: String, password: String): SupabaseSession {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    val url = URLBuilder(baseUrl).apply {
      appendPathSegments("auth", "v1", "token")
      parameters.append("grant_type", "password")
    }.buildString()

    val session = http.post(url) {
      header("apikey", config.anonKey)
      accept(ContentType.Application.Json)
      header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
      setBody(SupabasePasswordGrantRequest(email = email, password = password))
    }.body<SupabaseSession>()

    storage.save(session)
    return session
  }

  /**
   * Creates a new user using Supabase Auth signup.
   *
   * Note: This does NOT replace the current app session stored in [SessionStorage].
   * If your Supabase project has "disable signups" / invite-only enabled, this will fail.
   */
  @Throws(Exception::class)
  suspend fun signUpWithPassword(email: String, password: String): SupabaseUser {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    val url = URLBuilder(baseUrl).apply { appendPathSegments("auth", "v1", "signup") }.buildString()
    val resp =
      http.post(url) {
        header("apikey", config.anonKey)
        accept(ContentType.Application.Json)
        header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        setBody(SupabaseSignUpRequest(email = email.trim(), password = password))
      }.body<SupabaseAuthResponse>()

    return resp.user ?: error("Signup failed (no user returned).")
  }

  @Throws(Exception::class)
  suspend fun sendPasswordRecovery(email: String) {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    val url = URLBuilder(baseUrl).apply { appendPathSegments("auth", "v1", "recover") }.buildString()
    http.post(url) {
      header("apikey", config.anonKey)
      accept(ContentType.Application.Json)
      header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
      setBody(SupabaseRecoverRequest(email = email.trim()))
    }
  }

  @Throws(Exception::class)
  suspend fun listLeads(limit: Int = 100): List<LeadSummary> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    return withValidAccessToken { token -> listLeadsWithToken(token, limit) }
  }

  @Throws(Exception::class)
  suspend fun listLeadsDetailed(limit: Int = 1000): List<Lead> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    return withValidAccessToken { token -> listLeadsDetailedWithToken(token, limit) }
  }

  private suspend fun listLeadsWithToken(accessToken: String, limit: Int): List<LeadSummary> {
    val url = URLBuilder(baseUrl).apply {
      appendPathSegments("rest", "v1", "leads")
      parameters.append(
        "select",
        "id,owner_id,created_by,name,company,phone,location,status,loan_amount,next_follow_up,mediator_id,is_high_potential,assigned_staff,documents,updated_at,created_at",
      )
      parameters.append("order", "updated_at.desc")
      parameters.append("limit", limit.toString())
    }.buildString()

    return http.get(url) {
      header("apikey", config.anonKey)
      header("Authorization", "Bearer $accessToken")
      accept(ContentType.Application.Json)
    }.body()
  }

  private suspend fun listLeadsDetailedWithToken(accessToken: String, limit: Int): List<Lead> {
    val url = URLBuilder(baseUrl).apply {
      appendPathSegments("rest", "v1", "leads")
      parameters.append(
        "select",
        "id,owner_id,created_by,name,company,phone,location,status,loan_amount,next_follow_up,mediator_id,is_high_potential,assigned_staff,documents,notes,loan_details,rejection_details,updated_at,created_at",
      )
      parameters.append("order", "updated_at.desc")
      parameters.append("limit", limit.toString())
    }.buildString()

    return http.get(url) {
      header("apikey", config.anonKey)
      header("Authorization", "Bearer $accessToken")
      accept(ContentType.Application.Json)
    }.body()
  }

  @Throws(Exception::class)
  suspend fun getLead(id: String): Lead {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "leads")
        parameters.append("select", "*")
        parameters.append("id", "eq.$id")
        parameters.append("limit", "1")
      }.buildString()

      val items: List<Lead> =
        http.get(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          accept(ContentType.Application.Json)
        }.body()

      items.firstOrNull() ?: error("Lead not found.")
    }
  }

  @Throws(Exception::class)
  suspend fun createLead(input: LeadCreateInput): Lead {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "leads")
      }.buildString()

      val body =
        buildJsonObject {
          put("owner_id", userId)
          put("created_by", userId)
          put("name", input.name)
          putOrNull("phone", input.phone)
          putOrNull("company", input.company)
          putOrNull("location", input.location)
          putOrNull("status", input.status)
          input.loanAmount?.let { put("loan_amount", it) }
          putOrNull("next_follow_up", input.nextFollowUp)
          putOrNull("mediator_id", input.mediatorId)
          input.isHighPotential?.let { put("is_high_potential", it) }
          putOrNull("assigned_staff", input.assignedStaff)
          input.documents?.let { put("documents", DefaultJson.encodeToJsonElement(LeadDocuments.serializer(), it)) }
          input.notes?.let { put("notes", DefaultJson.encodeToJsonElement(ListSerializer(LeadNote.serializer()), it)) }
          input.loanDetails?.let { put("loan_details", DefaultJson.encodeToJsonElement(LoanDetails.serializer(), it)) }
          input.rejectionDetails?.let {
            put(
              "rejection_details",
              DefaultJson.encodeToJsonElement(RejectionDetails.serializer(), it),
            )
          }
        }

      val created: List<Lead> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      created.firstOrNull() ?: error("Create failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun updateLead(id: String, patch: LeadUpdate): Lead {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "leads")
        parameters.append("id", "eq.$id")
      }.buildString()

      val updated: List<Lead> =
        http.patch(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(patch)
        }.body()

      updated.firstOrNull() ?: error("Update failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun clearMediatorFromLeads(mediatorId: String) {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "leads")
        parameters.append("mediator_id", "eq.$mediatorId")
      }.buildString()

      val body =
        buildJsonObject {
          put("mediator_id", JsonNull)
        }

      http.patch(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        header("Prefer", "return=minimal")
        accept(ContentType.Application.Json)
        setBody(body)
      }
    }
  }

  @Throws(Exception::class)
  suspend fun deleteLead(id: String) {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "leads")
        parameters.append("id", "eq.$id")
      }.buildString()

      http.delete(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }
    }
  }

  @Throws(Exception::class)
  suspend fun listMediators(limit: Int = 200): List<Mediator> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "mediators")
        parameters.append("select", "id,name,phone,follow_up_history,created_at,updated_at")
        parameters.append("order", "updated_at.desc")
        parameters.append("limit", limit.toString())
      }.buildString()

      http.get(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }.body()
    }
  }

  @Throws(Exception::class)
  suspend fun createMediator(input: MediatorCreateInput): Mediator {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "mediators")
      }.buildString()

      val body =
        buildJsonObject {
          put("owner_id", userId)
          put("created_by", userId)
          put("name", input.name)
          putOrNull("phone", input.phone)
          input.followUpHistory?.let {
            put(
              "follow_up_history",
              DefaultJson.encodeToJsonElement(ListSerializer(MediatorFollowUpEntry.serializer()), it),
            )
          }
        }

      val created: List<Mediator> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      created.firstOrNull() ?: error("Create failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun updateMediator(id: String, patch: MediatorUpdate): Mediator {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "mediators")
        parameters.append("id", "eq.$id")
      }.buildString()

      val updated: List<Mediator> =
        http.patch(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(patch)
        }.body()

      updated.firstOrNull() ?: error("Update failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun deleteMediator(id: String) {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }

    withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "mediators")
        parameters.append("id", "eq.$id")
      }.buildString()

      http.delete(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }
    }
  }

  // ---- Underwriting (Hardcoded Rule Engine) ----

  @Throws(Exception::class)
  suspend fun listUnderwritingApplications(leadId: String, limit: Int = 50): List<UnderwritingApplicationListItem> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "underwriting_applications")
        parameters.append(
          "select",
          "id,lead_id,created_at,status,period_start,period_end,bank_name,account_type,requested_exposure,aggressive_summary",
        )
        parameters.append("lead_id", "eq.$leadId")
        parameters.append("order", "created_at.desc")
        parameters.append("limit", limit.toString())
      }.buildString()

      http.get(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }.body()
    }
  }

  @Throws(Exception::class)
  suspend fun listUnderwritingApplicationsAll(limit: Int = 200): List<UnderwritingApplicationListItem> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "underwriting_applications")
        parameters.append(
          "select",
          "id,lead_id,created_at,status,period_start,period_end,bank_name,account_type,requested_exposure,aggressive_summary",
        )
        parameters.append("order", "created_at.desc")
        parameters.append("limit", limit.toString())
      }.buildString()

      http.get(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }.body()
    }
  }

  @Throws(Exception::class)
  suspend fun getUnderwritingApplication(id: String): UnderwritingApplicationRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "underwriting_applications")
        parameters.append("select", "*")
        parameters.append("id", "eq.$id")
        parameters.append("limit", "1")
      }.buildString()

      val items: List<UnderwritingApplicationRow> =
        http.get(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          accept(ContentType.Application.Json)
        }.body()

      items.firstOrNull() ?: error("Underwriting application not found.")
    }
  }

  @Throws(Exception::class)
  suspend fun createUnderwritingApplication(input: UnderwritingApplicationCreateInput): UnderwritingApplicationRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply { appendPathSegments("rest", "v1", "underwriting_applications") }.buildString()

      val body =
        buildJsonObject {
          put("owner_id", input.ownerId)
          put("created_by", userId)
          input.leadId?.let { put("lead_id", it) }
          put("status", input.status)
          input.periodStart?.let { put("period_start", it) }
          input.periodEnd?.let { put("period_end", it) }
          put("bank_name", input.bankName)
          put("account_type", input.accountType)
          put("requested_exposure", input.requestedExposure)
          put("report_json", input.reportJson)
          put("aggressive_summary", input.aggressiveSummary)
        }

      val created: List<UnderwritingApplicationRow> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      created.firstOrNull() ?: error("Create failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun listUnderwritingDocuments(applicationId: String, limit: Int = 50): List<UnderwritingDocumentRow> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "underwriting_documents")
        parameters.append("select", "*")
        parameters.append("application_id", "eq.$applicationId")
        parameters.append("order", "created_at.desc")
        parameters.append("limit", limit.toString())
      }.buildString()

      http.get(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }.body()
    }
  }

  @Throws(Exception::class)
  suspend fun createUnderwritingDocument(input: UnderwritingDocumentCreateInput): UnderwritingDocumentRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply { appendPathSegments("rest", "v1", "underwriting_documents") }.buildString()

      val body =
        buildJsonObject {
          put("application_id", input.applicationId)
          put("owner_id", input.ownerId)
          put("created_by", userId)
          put("type", input.type)
          put("storage_path", input.storagePath)
          put("meta_json", input.metaJson)
        }

      val created: List<UnderwritingDocumentRow> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      created.firstOrNull() ?: error("Create failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun uploadUnderwritingDocument(
    applicationId: String,
    ownerId: String,
    fileName: String,
    bytes: ByteArray,
    contentType: String,
  ): String {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    if (bytes.isEmpty()) throw IOException("Empty file.")

    val safeName = sanitizeFileName(fileName)
    val path = "${ownerId.trim()}/underwriting/$applicationId/${currentMillis()}_$safeName"

    withValidAccessToken { token ->
      val url = "${baseUrl}/storage/v1/object/${attachmentsBucket}/${path}"
      http.post(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        header("x-upsert", "true")
        header(HttpHeaders.ContentType, contentType)
        setBody(bytes)
      }
    }

    return path
  }

  // ---- Statement Autopilot ----

  @Throws(Exception::class)
  suspend fun createStatement(input: StatementCreateInput): StatementRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply { appendPathSegments("rest", "v1", "statements") }.buildString()
      val body =
        buildJsonObject {
          put("owner_id", input.ownerId)
          put("created_by", userId)
          input.leadId?.let { put("lead_id", it) }
          input.accountId?.let { put("account_id", it) }
        }

      val created: List<StatementRow> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      created.firstOrNull() ?: error("Create statement failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun createStatementVersion(input: StatementVersionCreateInput): StatementVersionRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply { appendPathSegments("rest", "v1", "statement_versions") }.buildString()
      val body =
        buildJsonObject {
          put("statement_id", input.statementId)
          put("owner_id", input.ownerId)
          put("created_by", userId)
          put("status", input.status)
          put("version_no", input.versionNo)
          input.bankName?.let { put("bank_name", it) }
          input.accountType?.let { put("account_type", it) }
          input.periodStart?.let { put("period_start", it) }
          input.periodEnd?.let { put("period_end", it) }
          input.reportJson?.let { put("report_json", it) }
        }

      val created: List<StatementVersionRow> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      created.firstOrNull() ?: error("Create statement version failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun createPdfFile(input: PdfFileCreateInput): PdfFileRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply { appendPathSegments("rest", "v1", "pdf_files") }.buildString()
      val body =
        buildJsonObject {
          put("statement_version_id", input.statementVersionId)
          put("owner_id", input.ownerId)
          put("created_by", userId)
          put("storage_path", input.storagePath)
          input.fileName?.let { put("file_name", it) }
          input.metaJson?.let { put("meta_json", it) }
        }

      val created: List<PdfFileRow> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      created.firstOrNull() ?: error("Create pdf file failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun uploadStatementPdf(
    ownerId: String,
    statementVersionId: String,
    fileName: String,
    bytes: ByteArray,
    contentType: String,
  ): String {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    if (bytes.isEmpty()) throw IOException("Empty file.")

    val safeName = sanitizeFileName(fileName)
    val path = "${ownerId.trim()}/statements/$statementVersionId/${currentMillis()}_$safeName"

    withValidAccessToken { token ->
      val url = "${baseUrl}/storage/v1/object/${attachmentsBucket}/${path}"
      http.post(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        header("x-upsert", "true")
        header(HttpHeaders.ContentType, contentType)
        setBody(bytes)
      }
    }

    return path
  }

  @Throws(Exception::class)
  suspend fun updateStatementVersionStatus(versionId: String, status: String): StatementVersionRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "statement_versions")
        parameters.append("id", "eq.$versionId")
      }.buildString()

      val body =
        buildJsonObject {
          put("status", status)
        }

      val updated: List<StatementVersionRow> =
        http.patch(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      updated.firstOrNull() ?: error("Update statement version failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun insertRawStatementLines(input: List<RawStatementLineCreateInput>) {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    if (input.isEmpty()) return
    val userId = requireUserId()

    withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply { appendPathSegments("rest", "v1", "raw_statement_lines") }.buildString()

      val body =
        input.map { row ->
        buildJsonObject {
          put("statement_version_id", row.versionId)
          put("owner_id", row.ownerId)
          put("created_by", userId)
          row.pdfFileId?.let { put("pdf_file_id", it) }
          put("page_no", row.pageNo)
          put("row_no", row.rowNo)
          put("raw_row_text", row.rawRowText)
            row.rawDateText?.let { put("raw_date_text", it) }
            row.rawNarrationText?.let { put("raw_narration_text", it) }
            row.rawDrText?.let { put("raw_dr_text", it) }
            row.rawCrText?.let { put("raw_cr_text", it) }
            row.rawBalanceText?.let { put("raw_balance_text", it) }
            put("raw_line_type", row.rawLineType)
            row.extractionMethod?.let { put("extraction_method", it) }
            row.bboxJson?.let { put("bbox_json", it) }
          }
        }

      http.post(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        accept(ContentType.Application.Json)
        setBody(body)
      }
    }
  }

  @Throws(Exception::class)
  suspend fun insertStatementTransactions(input: List<TransactionCreateInput>) {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    if (input.isEmpty()) return
    val userId = requireUserId()

    withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply { appendPathSegments("rest", "v1", "transactions") }.buildString()

      val body =
        input.map { row ->
        buildJsonObject {
          put("statement_version_id", row.versionId)
          put("owner_id", row.ownerId)
          put("created_by", userId)
            put("raw_line_ids", DefaultJson.encodeToJsonElement(row.rawLineIds))
            put("date", row.date)
            put("month", row.month)
            put("narration", row.narration)
            put("dr", row.dr)
            put("cr", row.cr)
            row.balance?.let { put("balance", it) }
            put("counterparty_norm", row.counterpartyNorm)
            put("txn_type", row.txnType)
            put("category", row.category)
            row.flagsJson?.let { put("flags_json", it) }
            put("transaction_uid", row.transactionUid)
          }
        }

      http.post(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        accept(ContentType.Application.Json)
        setBody(body)
      }
    }
  }

  // ---- PD (Personal Discussion) + Dynamic Doubts ----

  @Throws(Exception::class)
  suspend fun getPdSessionByApplicationId(applicationId: String): PdSessionRow? {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_sessions")
        parameters.append("select", "*")
        parameters.append("application_id", "eq.$applicationId")
        parameters.append("limit", "1")
      }.buildString()

      val items: List<PdSessionRow> =
        http.get(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          accept(ContentType.Application.Json)
        }.body()

      items.firstOrNull()
    }
  }

  @Throws(Exception::class)
  suspend fun listPdSessions(limit: Int = 200): List<PdSessionRow> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_sessions")
        parameters.append("select", "*")
        parameters.append("order", "updated_at.desc")
        parameters.append("limit", limit.toString())
      }.buildString()

      http.get(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }.body()
    }
  }

  /**
   * Idempotent session creation. If a session already exists for this application, returns it.
   */
  @Throws(Exception::class)
  suspend fun getOrCreatePdSession(input: PdSessionCreateInput): PdSessionRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val existing = getPdSessionByApplicationId(input.applicationId)
    if (existing != null) return existing

    val userId = requireUserId()
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply { appendPathSegments("rest", "v1", "pd_sessions") }.buildString()

      val body =
        buildJsonObject {
          put("application_id", input.applicationId)
          put("owner_id", input.ownerId)
          put("created_by", userId)
          put("status", input.status)
          put("open_items_status", input.openItemsStatus)
        }

      val created: List<PdSessionRow> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      created.firstOrNull() ?: error("Create PD session failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun updatePdSession(id: String, patch: PdSessionUpdate): PdSessionRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_sessions")
        parameters.append("id", "eq.$id")
      }.buildString()

      val body =
        buildJsonObject {
          putOrNull("status", patch.status)
          putOrNull("open_items_status", patch.openItemsStatus)
          put("updated_by", userId)
        }

      val updated: List<PdSessionRow> =
        http.patch(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      updated.firstOrNull() ?: error("Update PD session failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun getPdAnswer(pdSessionId: String, fieldKey: String): PdAnswerRow? {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_answers")
        parameters.append("select", "*")
        parameters.append("pd_session_id", "eq.$pdSessionId")
        parameters.append("field_key", "eq.$fieldKey")
        parameters.append("limit", "1")
      }.buildString()

      val items: List<PdAnswerRow> =
        http.get(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          accept(ContentType.Application.Json)
        }.body()

      items.firstOrNull()
    }
  }

  @Throws(Exception::class)
  suspend fun upsertPdAnswer(input: PdAnswerUpsertInput): PdAnswerRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_answers")
        parameters.append("on_conflict", "pd_session_id,field_key")
      }.buildString()

      val body =
        buildJsonObject {
          put("owner_id", input.ownerId)
          put("pd_session_id", input.pdSessionId)
          put("created_by", userId)
          put("updated_by", userId)
          put("field_key", input.fieldKey)
          put("field_label", input.fieldLabel)
          input.valueText?.let { put("value_text", it) }
          input.valueNumber?.let { put("value_number", it) }
          input.valueJson?.let { put("value_json", it) }
        }

      val updated: List<PdAnswerRow> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation,resolution=merge-duplicates")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      updated.firstOrNull() ?: error("Upsert PD answer failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun listPdGeneratedQuestions(pdSessionId: String, limit: Int = 500): List<PdGeneratedQuestionRow> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_generated_questions")
        parameters.append("select", "*")
        parameters.append("pd_session_id", "eq.$pdSessionId")
        parameters.append("order", "created_at.asc")
        parameters.append("limit", limit.toString())
      }.buildString()

      http.get(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }.body()
    }
  }

  @Throws(Exception::class)
  suspend fun listPdGeneratedQuestionsForSessions(
    pdSessionIds: List<String>,
    severity: String? = null,
    statuses: List<String> = emptyList(),
    limit: Int = 500,
  ): List<PdGeneratedQuestionRow> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    if (pdSessionIds.isEmpty()) return emptyList()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_generated_questions")
        parameters.append("select", "*")
        parameters.append("pd_session_id", "in.(${pdSessionIds.joinToString(",")})")
        severity?.takeIf { it.isNotBlank() }?.let { parameters.append("severity", "eq.$it") }
        if (statuses.isNotEmpty()) parameters.append("status", "in.(${statuses.joinToString(",")})")
        parameters.append("order", "updated_at.desc")
        parameters.append("limit", limit.toString())
      }.buildString()

      http.get(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }.body()
    }
  }

  @Throws(Exception::class)
  suspend fun upsertPdGeneratedQuestionsIgnoreDuplicates(rows: List<PdGeneratedQuestionUpsertInput>) {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    if (rows.isEmpty()) return
    val userId = requireUserId()

    withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_generated_questions")
        parameters.append("on_conflict", "pd_session_id,code")
      }.buildString()

      val body =
        rows.map { r ->
          buildJsonObject {
            put("owner_id", r.ownerId)
            put("pd_session_id", r.pdSessionId)
            put("created_by", userId)
            put("code", r.code)
            put("severity", r.severity)
            put("category", r.category)
            put("question_text", r.questionText)
            put("answer_type", r.answerType)
            r.optionsJson?.let { put("options_json", it) }
            r.evidenceJson?.let { put("evidence_json", it) }
            r.sourceRuleId?.let { put("source_rule_id", it) }
            put("status", r.status)
          }
        }

      http.post(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        header("Prefer", "resolution=ignore-duplicates")
        accept(ContentType.Application.Json)
        setBody(body)
      }
    }
  }

  @Throws(Exception::class)
  suspend fun updatePdGeneratedQuestion(id: String, patch: PdGeneratedQuestionUpdate) {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_generated_questions")
        parameters.append("id", "eq.$id")
      }.buildString()

      val body =
        buildJsonObject {
          putOrNull("status", patch.status)
          put("updated_by", userId)
        }

      http.patch(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        accept(ContentType.Application.Json)
        setBody(body)
      }
    }
  }

  @Throws(Exception::class)
  suspend fun listPdGeneratedAnswers(questionIds: List<String>, limit: Int = 500): List<PdGeneratedAnswerRow> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    if (questionIds.isEmpty()) return emptyList()

    val ids = questionIds.distinct().take(200)
    val inExpr = "in.(${ids.joinToString(",")})"

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_generated_answers")
        parameters.append("select", "*")
        parameters.append("question_id", inExpr)
        parameters.append("limit", limit.toString())
      }.buildString()

      http.get(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        accept(ContentType.Application.Json)
      }.body()
    }
  }

  @Throws(Exception::class)
  suspend fun upsertPdGeneratedAnswer(input: PdGeneratedAnswerUpsertInput): PdGeneratedAnswerRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply {
        appendPathSegments("rest", "v1", "pd_generated_answers")
        parameters.append("on_conflict", "question_id")
      }.buildString()

      val body =
        buildJsonObject {
          put("owner_id", input.ownerId)
          put("question_id", input.questionId)
          put("updated_by", userId)
          input.answerText?.let { put("answer_text", it) }
          input.answerNumber?.let { put("answer_number", it) }
          input.answerJson?.let { put("answer_json", it) }
          input.attachmentPath?.let { put("attachment_path", it) }
        }

      val updated: List<PdGeneratedAnswerRow> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation,resolution=merge-duplicates")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      updated.firstOrNull() ?: error("Upsert PD generated answer failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun createPdAttachment(input: PdAttachmentCreateInput): PdAttachmentRow {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val userId = requireUserId()

    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply { appendPathSegments("rest", "v1", "pd_attachments") }.buildString()

      val body =
        buildJsonObject {
          put("pd_session_id", input.pdSessionId)
          put("owner_id", input.ownerId)
          put("created_by", userId)
          input.questionId?.let { put("question_id", it) }
          put("storage_path", input.storagePath)
          put("file_type", input.fileType)
          put("meta_json", input.metaJson)
        }

      val created: List<PdAttachmentRow> =
        http.post(url) {
          header("apikey", config.anonKey)
          header("Authorization", "Bearer $token")
          header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
          header("Prefer", "return=representation")
          accept(ContentType.Application.Json)
          setBody(body)
        }.body()

      created.firstOrNull() ?: error("Create PD attachment failed.")
    }
  }

  @Throws(Exception::class)
  suspend fun uploadPdAttachment(
    ownerId: String,
    pdSessionId: String,
    questionId: String?,
    fileName: String,
    bytes: ByteArray,
    contentType: String,
  ): String {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    if (bytes.isEmpty()) throw IOException("Empty file.")

    val safeName = sanitizeFileName(fileName)
    val q = questionId?.takeIf { it.isNotBlank() } ?: "general"
    val path = "${ownerId.trim()}/pd/$pdSessionId/$q/${currentMillis()}_$safeName"

    withValidAccessToken { token ->
      val url = "${baseUrl}/storage/v1/object/${attachmentsBucket}/${path}"
      http.post(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        header("x-upsert", "true")
        header(HttpHeaders.ContentType, contentType)
        setBody(bytes)
      }
    }

    return path
  }

  // ---- Attachments (Supabase Storage) ----

  @Throws(Exception::class)
  suspend fun listLeadAttachments(ownerId: String, leadId: String, limit: Int = 100): List<StorageObject> {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    val prefix = "${ownerId.trim()}/$leadId/"
    return listObjects(bucket = attachmentsBucket, prefix = prefix, limit = limit)
  }

  @Throws(Exception::class)
  suspend fun listLeadAttachments(leadId: String, limit: Int = 100): List<StorageObject> {
    val ownerId = requireUserId()
    return listLeadAttachments(ownerId = ownerId, leadId = leadId, limit = limit)
  }

  @Throws(Exception::class)
  suspend fun uploadLeadAttachment(
    ownerId: String,
    leadId: String,
    fileName: String,
    bytes: ByteArray,
    contentType: String,
  ): String {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    if (bytes.isEmpty()) throw IOException("Empty file.")

    val safeName = sanitizeFileName(fileName)
    val path = "${ownerId.trim()}/$leadId/${currentMillis()}_$safeName"

    withValidAccessToken { token ->
      val url = "${baseUrl}/storage/v1/object/${attachmentsBucket}/${path}"
      http.post(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        header("x-upsert", "true")
        header(HttpHeaders.ContentType, contentType)
        setBody(bytes)
      }
    }

    return path
  }

  @Throws(Exception::class)
  suspend fun uploadLeadAttachment(
    leadId: String,
    fileName: String,
    bytes: ByteArray,
    contentType: String,
  ): String {
    val ownerId = requireUserId()
    return uploadLeadAttachment(ownerId = ownerId, leadId = leadId, fileName = fileName, bytes = bytes, contentType = contentType)
  }

  @Throws(Exception::class)
  suspend fun downloadLeadAttachment(path: String): ByteArray {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    return withValidAccessToken { token ->
      val url = "${baseUrl}/storage/v1/object/authenticated/${attachmentsBucket}/${path}"

      http.get(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
      }.body()
    }
  }

  @Throws(Exception::class)
  suspend fun deleteLeadAttachment(path: String) {
    require(isConfigured()) { "Supabase is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)." }
    withValidAccessToken { token ->
      val url = "${baseUrl}/storage/v1/object/${attachmentsBucket}/${path}"
      http.delete(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
      }
    }
  }

  private suspend fun listObjects(bucket: String, prefix: String, limit: Int): List<StorageObject> {
    return withValidAccessToken { token ->
      val url = URLBuilder(baseUrl).apply { appendPathSegments("storage", "v1", "object", "list", bucket) }.buildString()
      http.post(url) {
        header("apikey", config.anonKey)
        header("Authorization", "Bearer $token")
        header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        accept(ContentType.Application.Json)
        setBody(StorageListRequest(prefix = prefix, limit = limit))
      }.body()
    }
  }

  private fun sanitizeFileName(raw: String): String {
    val base = raw.trim().ifEmpty { "attachment" }
    return base
      .replace('\\', '_')
      .replace('/', '_')
      .replace(Regex("[^A-Za-z0-9._-]"), "_")
      .take(120)
  }

  private fun currentMillis(): Long = Clock.System.now().toEpochMilliseconds()

  private suspend fun <T> withValidAccessToken(block: suspend (accessToken: String) -> T): T {
    val session = requireNotNull(storage.load()) { "Not signed in." }
    return try {
      block(session.accessToken)
    } catch (e: ClientRequestException) {
      if (e.response.status != HttpStatusCode.Unauthorized) throw e
      val refreshed = refreshSession(session)
      block(refreshed.accessToken)
    }
  }

  private suspend fun refreshSession(current: SupabaseSession): SupabaseSession {
    val url = URLBuilder(baseUrl).apply {
      appendPathSegments("auth", "v1", "token")
      parameters.append("grant_type", "refresh_token")
    }.buildString()

    val refreshed = http.post(url) {
      header("apikey", config.anonKey)
      accept(ContentType.Application.Json)
      header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
      setBody(SupabaseRefreshRequest(refreshToken = current.refreshToken))
    }.body<SupabaseSession>()

    storage.save(refreshed)
    return refreshed
  }

  private fun JsonObjectBuilder.putOrNull(key: String, value: String?) {
    if (value == null) return
    val v = value.trim()
    if (v.isEmpty()) return
    put(key, v)
  }

  @OptIn(ExperimentalEncodingApi::class)
  private fun decodeJwtSub(token: String): String? {
    return try {
      val parts = token.split(".")
      if (parts.size < 2) return null
      val payload = parts[1]
      val padded =
        payload
          .replace('-', '+')
          .replace('_', '/')
          .let { s ->
            val pad = (4 - (s.length % 4)) % 4
            s + "=".repeat(pad)
          }

      val json = Base64.decode(padded).decodeToString()
      DefaultJson.parseToJsonElement(json).jsonObject["sub"]?.jsonPrimitive?.content
    } catch (_: Exception) {
      null
    }
  }

  private fun normalizeSupabaseUrl(raw: String): String {
    val v = raw.trim().removeSuffix("/")
    if (v.isEmpty()) return ""
    if (v.startsWith("https://") || v.startsWith("http://")) return v
    if (v.contains(".")) return "https://$v"
    return "https://$v.supabase.co"
  }
}
