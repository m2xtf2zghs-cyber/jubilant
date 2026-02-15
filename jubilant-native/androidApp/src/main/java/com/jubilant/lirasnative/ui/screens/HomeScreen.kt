package com.jubilant.lirasnative.ui.screens

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.FactCheck
import androidx.compose.material.icons.outlined.MeetingRoom
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Undo
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.CallLog
import android.widget.Toast
import com.jubilant.lirasnative.BuildConfig
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.di.MediatorsRepository
import com.jubilant.lirasnative.di.PdRepository
import com.jubilant.lirasnative.di.ProfilesRepository
import com.jubilant.lirasnative.di.UnderwritingRepository
import com.jubilant.lirasnative.R
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.shared.supabase.MediatorFollowUpEntry
import com.jubilant.lirasnative.shared.supabase.MediatorUpdate
import com.jubilant.lirasnative.ui.components.BankingBackground
import com.jubilant.lirasnative.ui.components.BrandHeader
import com.jubilant.lirasnative.ui.components.BrandMark
import com.jubilant.lirasnative.ui.theme.Blue500
import com.jubilant.lirasnative.ui.theme.Danger500
import com.jubilant.lirasnative.ui.theme.Gold500
import com.jubilant.lirasnative.ui.theme.Navy950
import com.jubilant.lirasnative.ui.theme.Success500
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.isoToKolkataLocalDateTime
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTicker
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTimeTicker
import com.jubilant.lirasnative.ui.util.showDatePicker
import com.jubilant.lirasnative.ui.util.showTimePicker
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.YearMonth
import java.time.temporal.ChronoUnit
import java.time.format.DateTimeFormatter
import java.time.Instant
import kotlinx.coroutines.launch

private enum class MainDest(
  val route: String,
  val label: String,
) {
  Home("dashboard", "Home"),
  Leads("leads", "Leads"),
  Collections("collections", "Collections"),
  More("more", "More"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
  leadsRepository: LeadsRepository,
  mediatorsRepository: MediatorsRepository,
  profilesRepository: ProfilesRepository,
  underwritingRepository: UnderwritingRepository,
  pdRepository: PdRepository,
  onSignOut: () -> Unit,
  navTargetRoute: String?,
  onNavTargetHandled: () -> Unit,
) {
  val leadsVm: LeadsViewModel = viewModel(factory = LeadsViewModel.factory(leadsRepository))
  val leadsState by leadsVm.state.collectAsState()

  val mediatorsVm: MediatorsViewModel = viewModel(factory = MediatorsViewModel.factory(mediatorsRepository))
  val mediatorsState by mediatorsVm.state.collectAsState()

  val sessionVm: SessionViewModel = viewModel(factory = SessionViewModel.factory(profilesRepository))
  val sessionState by sessionVm.state.collectAsState()

  var leadsQuery by rememberSaveable { mutableStateOf("") }

  val nav = rememberNavController()
  val backStackEntry by nav.currentBackStackEntryAsState()
  val route = backStackEntry?.destination?.route.orEmpty()

  val isMainRoute =
    route == MainDest.Home.route ||
      route == MainDest.Leads.route ||
      route == MainDest.Collections.route ||
      route == MainDest.More.route ||
      route.isBlank()

  val title =
    when {
      route.startsWith("lead/") -> "Lead"
      route == "lead_new" -> "Add lead"
      route.startsWith("lead_edit/") -> "Edit lead"
      route == "mediator_new" -> "Add mediator"
      route.startsWith("mediator/") -> "Mediator"
      route.startsWith("pd/") -> "PD"
      route == MainDest.Leads.route -> MainDest.Leads.label
      route == MainDest.Collections.route -> MainDest.Collections.label
      route == MainDest.More.route -> MainDest.More.label
      route == "kanban" -> "Kanban"
      route == "calendar" -> "Calendar"
      route == "loan_book" -> "Loan book"
      route == "analytics" -> "Analytics"
      route == "reports" -> "Reports"
      route == "eod" -> "End of day"
      route == "underwriting" -> "Underwriting"
      route == "calculator" -> "Calculator"
      route == "data_tools" -> "Backup & CSV"
      route == "my_day" -> "My Day"
      route == "crm_network" -> "CRM / Network"
      route == "settings" -> "Settings"
      else -> MainDest.Home.label
    }

  LaunchedEffect(navTargetRoute) {
    val target = navTargetRoute?.trim().orEmpty()
    if (target.isBlank()) return@LaunchedEffect
    if (target == MainDest.Home.route) {
      onNavTargetHandled()
      return@LaunchedEffect
    }
    runCatching {
      nav.navigate(target) {
        launchSingleTop = true
      }
    }
    onNavTargetHandled()
  }

  LaunchedEffect(Unit) {
    sessionVm.refresh()
    leadsVm.refresh()
    mediatorsVm.refresh()
  }

  fun refreshAll() {
    sessionVm.refresh()
    leadsVm.refresh()
    mediatorsVm.refresh()
  }

  BankingBackground {
    Scaffold(
      containerColor = Color.Transparent,
      topBar = {
        TopAppBar(
          title = {
            if (isMainRoute) {
              val profile = sessionState.myProfile
              val userLabel =
                profile?.fullName?.trim()?.takeIf { it.isNotBlank() }
                  ?: profile?.email?.trim()?.takeIf { it.isNotBlank() }
                  ?: sessionState.userId?.trim().orEmpty()
              val subtitle = if (userLabel.isNotBlank()) "$title • $userLabel" else title
              BrandHeader(title = stringResource(R.string.app_name), subtitle = subtitle)
            } else {
              Row(verticalAlignment = Alignment.CenterVertically) {
                BrandMark(size = 30.dp)
                Spacer(Modifier.width(12.dp))
                Text(title, style = MaterialTheme.typography.titleLarge)
              }
            }
          },
          navigationIcon = {
            if (!isMainRoute) {
              IconButton(onClick = { nav.popBackStack() }) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
              }
            }
          },
          actions = {
            if (isMainRoute) {
              IconButton(onClick = { refreshAll() }) {
                Icon(Icons.Outlined.Refresh, contentDescription = "Refresh")
              }
            }
            IconButton(onClick = onSignOut) {
              Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = "Sign out")
            }
          },
          colors =
            TopAppBarDefaults.topAppBarColors(
              containerColor = MaterialTheme.colorScheme.background,
              titleContentColor = MaterialTheme.colorScheme.onBackground,
              navigationIconContentColor = MaterialTheme.colorScheme.onBackground,
              actionIconContentColor = MaterialTheme.colorScheme.onBackground,
            ),
        )
      },
      bottomBar = {
        if (isMainRoute) {
          BottomBar(nav = nav)
        }
      },
    ) { padding ->
      Box(modifier = Modifier.fillMaxSize().padding(padding)) {
        NavHost(
          navController = nav,
          startDestination = MainDest.Home.route,
        ) {
          composable(MainDest.Home.route) {
            DashboardTab(
              state = leadsState,
              leadsRepository = leadsRepository,
              mediators = mediatorsState.mediators,
              mediatorsRepository = mediatorsRepository,
              session = sessionState,
              onLeadClick = { id -> nav.navigate("lead/$id") },
              onOpenEod = { nav.navigate("eod") },
              onMutated = {
                leadsVm.refresh()
                mediatorsVm.refresh()
              },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }
          composable(MainDest.Leads.route) {
            LeadsTab(
              state = leadsState,
              session = sessionState,
              mediators = mediatorsState.mediators,
              query = leadsQuery,
              onQueryChange = { leadsQuery = it },
              onLeadClick = { id -> nav.navigate("lead/$id") },
              onCreateLead = { nav.navigate("lead_new") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }
          composable(MainDest.Collections.route) {
            CollectionsTab(
              leads = leadsState.leads,
              session = sessionState,
              onLeadClick = { id -> nav.navigate("lead/$id") },
              onOpenEod = { nav.navigate("eod") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }
          composable(MainDest.More.route) {
            MoreTab(
              session = sessionState,
              onOpenKanban = { nav.navigate("kanban") },
              onOpenCalendar = { nav.navigate("calendar") },
              onOpenLoanBook = { nav.navigate("loan_book") },
              onOpenAnalytics = { nav.navigate("analytics") },
              onOpenReports = { nav.navigate("reports") },
              onOpenUnderwriting = { nav.navigate("underwriting") },
              onOpenEod = { nav.navigate("eod") },
              onOpenCalculator = { nav.navigate("calculator") },
              onOpenDataTools = { nav.navigate("data_tools") },
              onOpenMyDay = { nav.navigate("my_day") },
              onOpenReminders = { nav.navigate("reminders") },
              onOpenScanDoc = { nav.navigate("scan_doc") },
              onOpenSecurity = { nav.navigate("security") },
              onOpenAdminAccess = { nav.navigate("admin_access") },
              onOpenCrmNetwork = { nav.navigate("crm_network") },
              onOpenSettings = { nav.navigate("settings") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("crm_network") {
            CrmNetworkScreen(
              leads = leadsState.leads,
              leadsRepository = leadsRepository,
              mediatorsState = mediatorsState,
              mediatorsRepository = mediatorsRepository,
              session = sessionState,
              onLeadClick = { id -> nav.navigate("lead/$id") },
              onMediatorClick = { id -> nav.navigate("mediator/$id") },
              onCreateMediator = { nav.navigate("mediator_new") },
              onMutated = {
                leadsVm.refresh()
                mediatorsVm.refresh()
              },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("settings") {
            SettingsHubScreen(
              session = sessionState,
              onOpenCalculator = { nav.navigate("calculator") },
              onOpenDataTools = { nav.navigate("data_tools") },
              onOpenReminders = { nav.navigate("reminders") },
              onOpenScanDoc = { nav.navigate("scan_doc") },
              onOpenSecurity = { nav.navigate("security") },
              onOpenAdminAccess = { nav.navigate("admin_access") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("mediators") {
            MediatorsTab(
              state = mediatorsState,
              leads = leadsState.leads,
              onMediatorClick = { id -> nav.navigate("mediator/$id") },
              onCreateMediator = { nav.navigate("mediator_new") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("kanban") {
            KanbanScreen(
              leads = leadsState.leads,
              leadsRepository = leadsRepository,
              onMutated = { leadsVm.refresh() },
              onLeadClick = { id -> nav.navigate("lead/$id") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("calendar") {
            CalendarScreen(
              leads = leadsState.leads,
              onLeadClick = { id -> nav.navigate("lead/$id") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("loan_book") {
            LoanBookScreen(
              leadsRepository = leadsRepository,
              mediators = mediatorsState.mediators,
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("analytics") {
            AnalyticsScreen(
              leadsRepository = leadsRepository,
              mediators = mediatorsState.mediators,
              onLeadClick = { id -> nav.navigate("lead/$id") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("reports") {
            ReportsScreen(
              leadsRepository = leadsRepository,
              mediators = mediatorsState.mediators,
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("underwriting") {
            UnderwritingScreen(
              leads = leadsState.leads,
              leadsRepository = leadsRepository,
              underwritingRepository = underwritingRepository,
              session = sessionState,
              onProceedToPd = { appId, leadId -> nav.navigate("pd/$appId/$leadId") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("pd/{applicationId}/{leadId}") { entry ->
            val appId = entry.arguments?.getString("applicationId").orEmpty()
            val leadId = entry.arguments?.getString("leadId").orEmpty()
            PdScreen(
              applicationId = appId,
              leadId = leadId,
              leadsRepository = leadsRepository,
              underwritingRepository = underwritingRepository,
              pdRepository = pdRepository,
              session = sessionState,
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("eod") {
            EodScreen(
              leads = leadsState.leads,
              leadsRepository = leadsRepository,
              mediators = mediatorsState.mediators,
              session = sessionState,
              onLeadClick = { id -> nav.navigate("lead/$id") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("calculator") {
            InterestCalculatorScreen(
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("data_tools") {
            DataToolsScreen(
              leadsRepository = leadsRepository,
              mediatorsRepository = mediatorsRepository,
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("scan_doc") {
            ScanDocScreen(
              leads = leadsState.leads,
              leadsRepository = leadsRepository,
              session = sessionState,
              onMutated = { leadsVm.refresh() },
              onLeadClick = { id -> nav.navigate("lead/$id") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("my_day") {
            MyDayScreen(
              leads = leadsState.leads,
              leadsRepository = leadsRepository,
              session = sessionState,
              onMutated = { leadsVm.refresh() },
              onLeadClick = { id -> nav.navigate("lead/$id") },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("reminders") {
            RemindersScreen(
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("security") {
            SecurityScreen(
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("admin_access") {
            AdminAccessScreen(
              profilesRepository = profilesRepository,
              session = sessionState,
              onChanged = { sessionVm.refresh() },
              modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp),
            )
          }

          composable("lead_new") {
            LeadFormScreen(
              leadsRepository = leadsRepository,
              mediators = mediatorsState.mediators,
              leadId = null,
              onCancel = { nav.popBackStack() },
              onSaved = {
                leadsVm.refresh()
                nav.popBackStack()
              },
            )
          }

          composable("lead/{leadId}") { entry ->
            val id = entry.arguments?.getString("leadId").orEmpty()
            LeadDetailScreen(
              leadId = id,
              leadsRepository = leadsRepository,
              mediators = mediatorsState.mediators,
              session = sessionState,
              onEdit = { nav.navigate("lead_edit/$id") },
              onDeleted = {
                leadsVm.refresh()
                nav.popBackStack(MainDest.Leads.route, false)
              },
              onMutated = { leadsVm.refresh() },
            )
          }

          composable("lead_edit/{leadId}") { entry ->
            val id = entry.arguments?.getString("leadId").orEmpty()
            LeadFormScreen(
              leadsRepository = leadsRepository,
              mediators = mediatorsState.mediators,
              leadId = id,
              onCancel = { nav.popBackStack() },
              onSaved = {
                leadsVm.refresh()
                nav.popBackStack()
              },
            )
          }

          composable("mediator_new") {
            MediatorFormScreen(
              mediatorsRepository = mediatorsRepository,
              onCancel = { nav.popBackStack() },
              onSaved = {
                mediatorsVm.refresh()
                nav.popBackStack()
              },
            )
          }

          composable("mediator/{mediatorId}") { entry ->
            val id = entry.arguments?.getString("mediatorId").orEmpty()
            val mediator = mediatorsState.mediators.firstOrNull { it.id == id }
            if (mediator == null) {
              ErrorScreen(message = "Mediator not found.")
            } else {
              MediatorDetailScreen(
                mediator = mediator,
                leads = leadsState.leads,
                leadsRepository = leadsRepository,
                mediatorsRepository = mediatorsRepository,
                onLeadClick = { leadId -> nav.navigate("lead/$leadId") },
                onDeleted = {
                  mediatorsVm.refresh()
                  leadsVm.refresh()
                  nav.popBackStack()
                },
                onMutated = { mediatorsVm.refresh() },
              )
            }
          }
        }

        if (leadsState.loading && leadsState.leads.isNotEmpty()) {
          LinearProgressIndicator(modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter))
        }
      }
    }
  }
}

@Composable
private fun BottomBar(nav: NavHostController) {
  val backStackEntry by nav.currentBackStackEntryAsState()
  val route = backStackEntry?.destination?.route

  fun navigateTo(dest: MainDest) {
    nav.navigate(dest.route) {
      popUpTo(nav.graph.findStartDestination().id) {
        saveState = true
      }
      launchSingleTop = true
      restoreState = true
    }
  }

  val itemColors =
    NavigationBarItemDefaults.colors(
      selectedIconColor = MaterialTheme.colorScheme.onBackground,
      unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
      selectedTextColor = MaterialTheme.colorScheme.onBackground,
      unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
      indicatorColor = Color.Transparent,
    )

  NavigationBar(containerColor = MaterialTheme.colorScheme.background, tonalElevation = 0.dp) {
    NavigationBarItem(
      selected = route == MainDest.Home.route,
      onClick = { navigateTo(MainDest.Home) },
      icon = { Icon(Icons.Outlined.Home, contentDescription = null) },
      label = { Text(MainDest.Home.label, style = MaterialTheme.typography.labelSmall) },
      alwaysShowLabel = true,
      colors = itemColors,
    )
    NavigationBarItem(
      selected = route == MainDest.Leads.route,
      onClick = { navigateTo(MainDest.Leads) },
      icon = { Icon(Icons.AutoMirrored.Outlined.List, contentDescription = null) },
      label = { Text(MainDest.Leads.label, style = MaterialTheme.typography.labelSmall) },
      alwaysShowLabel = true,
      colors = itemColors,
    )
    NavigationBarItem(
      selected = route == MainDest.Collections.route,
      onClick = { navigateTo(MainDest.Collections) },
      icon = { Icon(Icons.Outlined.FactCheck, contentDescription = null) },
      label = { Text(MainDest.Collections.label, style = MaterialTheme.typography.labelSmall) },
      alwaysShowLabel = true,
      colors = itemColors,
    )
    NavigationBarItem(
      selected = route == MainDest.More.route,
      onClick = { navigateTo(MainDest.More) },
      icon = { Icon(Icons.Outlined.Menu, contentDescription = null) },
      label = { Text(MainDest.More.label, style = MaterialTheme.typography.labelSmall) },
      alwaysShowLabel = true,
      colors = itemColors,
    )
  }
}

@Composable
private fun DashboardTab(
  state: LeadsState,
  leadsRepository: LeadsRepository,
  mediators: List<Mediator>,
  mediatorsRepository: MediatorsRepository,
  session: SessionState,
  onLeadClick: (id: String) -> Unit,
  onOpenEod: () -> Unit,
  onMutated: () -> Unit,
  modifier: Modifier = Modifier,
) {
  if (state.loading && state.leads.isEmpty()) {
    Row(
      modifier = modifier.fillMaxSize(),
      horizontalArrangement = Arrangement.Center,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      CircularProgressIndicator()
    }
    return
  }

  val metrics = remember(state.leads) { computeMetrics(state.leads) }
  val scroll = rememberScrollState()
  val ctx = LocalContext.current
  val scope = rememberCoroutineScope()
  val nowDate by rememberKolkataDateTicker()
  val nowDateTime by rememberKolkataDateTimeTicker()
  val actor = session.myProfile?.email ?: session.userId ?: "unknown"

  val monthlyKey = remember(nowDate) { "${nowDate.year}-${nowDate.monthValue.toString().padStart(2, '0')}" }
  val prefs = remember(ctx) { ctx.getSharedPreferences("liras_native_prefs", Context.MODE_PRIVATE) }
  val targetPrefKey = remember(monthlyKey) { "monthly_target_$monthlyKey" }
  val defaultTarget = 5_000_000L
  val callLogAutomationEnabled = remember { BuildConfig.CALL_LOG_AUTOMATION_ENABLED }

  var target by remember(monthlyKey) { mutableStateOf(prefs.getLong(targetPrefKey, defaultTarget)) }
  var editingTarget by remember { mutableStateOf(false) }
  var targetDraft by remember { mutableStateOf(target.toString()) }

  var partnerBusyId by remember { mutableStateOf<String?>(null) }
  var partnerError by remember { mutableStateOf<String?>(null) }

  val callLogPermission = Manifest.permission.READ_CALL_LOG
  var callLogGranted by
    remember {
      mutableStateOf(ContextCompat.checkSelfPermission(ctx, callLogPermission) == PackageManager.PERMISSION_GRANTED)
    }
  val callLogPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      callLogGranted = granted
    }

  val callLogLastProcessedPrefKey = "calllog_last_processed_ms"
  val callLogLastSyncDatePrefKey = "calllog_last_sync_date"
  val callLogLastSyncAtPrefKey = "calllog_last_sync_at"

  var callLogBusy by remember { mutableStateOf(false) }
  var callLogError by remember { mutableStateOf<String?>(null) }
  var callLogLastSyncAt by remember { mutableStateOf(prefs.getString(callLogLastSyncAtPrefKey, null)) }

  var triageBusyId by remember { mutableStateOf<String?>(null) }
  var triageError by remember { mutableStateOf<String?>(null) }

  LaunchedEffect(target, monthlyKey) {
    prefs.edit().putLong(targetPrefKey, target).apply()
  }

  val newLeads =
    remember(state.leads) {
      state.leads.filter { (it.status ?: "").trim().ifBlank { "New" } == "New" }.take(10)
    }

  val upcomingMeetings =
    remember(state.leads, nowDate) {
      val tomorrow = nowDate.plusDays(1)
      state.leads
        .asSequence()
        .filter { (it.status ?: "").trim() == "Meeting Scheduled" }
        .filter { l ->
          val d = isoToKolkataDate(l.nextFollowUp)
          d == nowDate || d == tomorrow
        }
        .sortedBy { isoToKolkataLocalDateTime(it.nextFollowUp) ?: LocalDateTime.MAX }
        .take(6)
        .toList()
    }

  val recentActivity =
    remember(state.leads) {
      state.leads.take(5)
    }

  val pendingMeetings =
    remember(state.leads) {
      state.leads.filter { l ->
        (l.status ?: "").trim() == "Meeting Scheduled" &&
          isoToKolkataLocalDateTime(l.nextFollowUp)?.isBefore(nowDateTime) == true &&
          isoToKolkataDate(l.updatedAt) != nowDate
      }
    }

  val pendingEod =
    remember(state.leads) {
      val closedStatuses = setOf("Payment Done", "Deal Closed")
      val rejectedStatuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor")
      state.leads
        .filter { l ->
          val s = (l.status ?: "").trim()
          s.isBlank() || (s !in closedStatuses && s !in rejectedStatuses)
        }
        .count { l -> isoToKolkataDate(l.updatedAt) != nowDate }
    }

  val monthlyStats =
    remember(state.leads, nowDate, target) {
      val closedStatuses = setOf("Payment Done", "Deal Closed")
      val rejectedStatuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor")
      val stuckStatuses = setOf("Statements Not Received", "Contact Details Not Received", "Interest Rate Issue")
      val thisMonth = YearMonth.from(nowDate)

      var achieved = 0L
      var pipeline = 0L
      var stuck = 0L

      state.leads.forEach { l ->
        val amt = l.loanAmount ?: 0L
        val status = (l.status ?: "").trim()
        if (status in closedStatuses) {
          val payDate = isoToKolkataDate(l.updatedAt ?: l.createdAt)
          if (payDate != null && YearMonth.from(payDate) == thisMonth) achieved += amt
        } else if (status !in rejectedStatuses) {
          if (status in stuckStatuses) stuck += amt else pipeline += amt
        }
      }

      val pct = if (target <= 0) 0 else ((achieved.toDouble() / target.toDouble()) * 100.0).toInt().coerceIn(0, 100)
      MonthlyTargetStats(
        target = target,
        achieved = achieved,
        pipeline = pipeline,
        stuck = stuck,
        percentage = pct,
      )
    }

  val todayKey = remember(nowDate) { nowDate.toString() }
  val activeMediators =
    remember(mediators) {
      mediators
        .filter { it.name.isNotBlank() }
        .sortedBy { it.name.trim().lowercase() }
    }

  fun openDial(phone: String) {
    val digits = phone.filter { it.isDigit() }
    if (digits.isBlank()) return
    runCatching { ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits"))) }
      .onFailure { Toast.makeText(ctx, "Couldn’t open dialer.", Toast.LENGTH_SHORT).show() }
  }

  fun openWhatsApp(phone: String, message: String) {
    val digits = phone.filter { it.isDigit() }
    if (digits.isBlank()) return
    val url = "https://wa.me/$digits?text=${Uri.encode(message)}"
    runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
      .onFailure { Toast.makeText(ctx, "Couldn’t open WhatsApp.", Toast.LENGTH_SHORT).show() }
  }

  fun normalizePhone(raw: String?): String {
    val digits = raw.orEmpty().filter { it.isDigit() }
    if (digits.isBlank()) return ""
    return if (digits.length > 10) digits.takeLast(10) else digits
  }

  fun syncMediatorCallsFromDeviceLog(silent: Boolean = false) {
    if (!callLogGranted) {
      callLogError = "Call log permission not granted."
      if (!silent) Toast.makeText(ctx, callLogError, Toast.LENGTH_LONG).show()
      return
    }
    if (callLogBusy) return

    val mediatorByPhone =
      activeMediators
        .mapNotNull { m ->
          val norm = normalizePhone(m.phone)
          if (norm.isBlank()) null else norm to m
        }
        .toMap()

    if (mediatorByPhone.isEmpty()) {
      callLogError = "No mediators with phone numbers found."
      if (!silent) Toast.makeText(ctx, callLogError, Toast.LENGTH_LONG).show()
      return
    }

    scope.launch {
      callLogBusy = true
      callLogError = null

      runCatching {
        val fallbackStartMs = nowDate.atStartOfDay(KOLKATA_ZONE).toInstant().toEpochMilli()
        val lastProcessedMs = prefs.getLong(callLogLastProcessedPrefKey, 0L).takeIf { it > 0L } ?: fallbackStartMs
        var maxSeenMs = lastProcessedMs

        val hits: MutableMap<String, MutableMap<String, String>> = mutableMapOf()
        val projection =
          arrayOf(
            CallLog.Calls.NUMBER,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.TYPE,
          )
        val selection = "${CallLog.Calls.DATE} >= ?"
        val selectionArgs = arrayOf(lastProcessedMs.toString())
        val sortOrder = "${CallLog.Calls.DATE} ASC"

        ctx.contentResolver
          .query(CallLog.Calls.CONTENT_URI, projection, selection, selectionArgs, sortOrder)
          ?.use { cursor ->
            val idxNumber = cursor.getColumnIndex(CallLog.Calls.NUMBER)
            val idxDate = cursor.getColumnIndex(CallLog.Calls.DATE)
            val idxDuration = cursor.getColumnIndex(CallLog.Calls.DURATION)
            val idxType = cursor.getColumnIndex(CallLog.Calls.TYPE)

            while (cursor.moveToNext()) {
              val number = if (idxNumber >= 0) cursor.getString(idxNumber) else null
              val dateMs = if (idxDate >= 0) cursor.getLong(idxDate) else 0L
              val durationSec = if (idxDuration >= 0) cursor.getLong(idxDuration) else 0L
              val type = if (idxType >= 0) cursor.getInt(idxType) else -1

              if (dateMs > maxSeenMs) maxSeenMs = dateMs

              val isVoiceCall = type == CallLog.Calls.OUTGOING_TYPE || type == CallLog.Calls.INCOMING_TYPE
              if (!isVoiceCall) continue
              if (durationSec <= 0L) continue

              val norm = normalizePhone(number)
              val mediator = mediatorByPhone[norm] ?: continue

              val dt = java.time.Instant.ofEpochMilli(dateMs).atZone(KOLKATA_ZONE).toLocalDateTime()
              val dateKey = dt.toLocalDate().toString()
              val timeLabel = dt.toLocalTime().format(DateTimeFormatter.ofPattern("hh:mm a"))

              val byDate = hits.getOrPut(mediator.id) { mutableMapOf() }
              byDate[dateKey] = timeLabel
            }
          }

        prefs.edit().putLong(callLogLastProcessedPrefKey, maxSeenMs + 1).apply()

        var updated = 0
        hits.forEach { (mediatorId, byDate) ->
          val mediator = activeMediators.firstOrNull { it.id == mediatorId } ?: return@forEach
          var nextHistory = mediator.followUpHistory
          var changed = false

          for ((dateKey, timeLabel) in byDate) {
            val existing = nextHistory.firstOrNull { it.date == dateKey }
            val existingType = existing?.type?.trim()?.lowercase()
            if (existingType == "meeting") continue

            nextHistory =
              nextHistory.filterNot { it.date == dateKey } +
                MediatorFollowUpEntry(
                  date = dateKey,
                  time = timeLabel,
                  type = "call",
                )
            changed = true
          }

          if (changed) {
            mediatorsRepository.updateMediator(
              mediator.id,
              MediatorUpdate(followUpHistory = nextHistory.takeLast(400)),
            )
            updated++
          }
        }

        val syncAt = Instant.now().toString()
        callLogLastSyncAt = syncAt
        prefs
          .edit()
          .putString(callLogLastSyncAtPrefKey, syncAt)
          .putString(callLogLastSyncDatePrefKey, todayKey)
          .apply()

        if (updated > 0) onMutated()
        if (!silent) {
          Toast
            .makeText(
              ctx,
              if (updated > 0) "Imported $updated mediator calls." else "No mediator calls found.",
              Toast.LENGTH_SHORT,
            )
            .show()
        }
      }
        .onFailure {
          callLogError = it.message ?: "Call log sync failed."
          if (!silent) Toast.makeText(ctx, callLogError, Toast.LENGTH_LONG).show()
        }

      callLogBusy = false
    }
  }

  LaunchedEffect(callLogGranted, todayKey) {
    if (!callLogGranted) return@LaunchedEffect
    val lastSyncDate = prefs.getString(callLogLastSyncDatePrefKey, null)
    if (lastSyncDate != todayKey) {
      syncMediatorCallsFromDeviceLog(silent = true)
    }
  }

  fun updatePartnerConnect(m: Mediator, type: String?) {
    if (partnerBusyId != null) return
    val now = LocalTime.now(KOLKATA_ZONE).format(DateTimeFormatter.ofPattern("hh:mm a"))
    val nextHistory =
      if (type == null) {
        m.followUpHistory.filterNot { it.date == todayKey }
      } else {
        val entry = MediatorFollowUpEntry(date = todayKey, time = now, type = type)
        val without = m.followUpHistory.filterNot { it.date == todayKey }
        without + entry
      }

    scope.launch {
      partnerBusyId = m.id
      partnerError = null
      runCatching {
        mediatorsRepository.updateMediator(
          m.id,
          MediatorUpdate(followUpHistory = nextHistory),
        )
      }
        .onFailure {
          partnerError = it.message ?: "Partner connect update failed."
          Toast.makeText(ctx, partnerError, Toast.LENGTH_LONG).show()
        }
        .onSuccess { onMutated() }
      partnerBusyId = null
    }
  }

  fun toIsoInstant(dt: LocalDateTime): String = dt.atZone(KOLKATA_ZONE).toInstant().toString()

  fun applyTriage(
    lead: LeadSummary,
    nextStatus: String,
    nextFollowUp: String?,
    noteText: String,
  ) {
    if (triageBusyId != null) return
    scope.launch {
      triageBusyId = lead.id
      triageError = null

      runCatching {
        val full = leadsRepository.getLead(lead.id)
        val note =
          LeadNote(
            text = noteText,
            date = Instant.now().toString(),
            byUser = actor,
          )
        val nextNotes = (full.notes + note).takeLast(500)
        leadsRepository.updateLead(
          lead.id,
          LeadUpdate(
            status = nextStatus,
            nextFollowUp = nextFollowUp,
            notes = nextNotes,
          ),
        )
      }
        .onSuccess { onMutated() }
        .onFailure { triageError = it.message ?: "Triage update failed." }

      triageBusyId = null
    }
  }

  Column(modifier = modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    state.error?.let { msg ->
      Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
      ) {
        Text(
          msg,
          modifier = Modifier.padding(12.dp),
          color = MaterialTheme.colorScheme.error,
          style = MaterialTheme.typography.bodyMedium,
        )
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = Navy950),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.15f)),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
          "Portfolio snapshot",
          style = MaterialTheme.typography.titleMedium,
          color = Color.White,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
          Column(modifier = Modifier.weight(1f)) {
            Text(
              "Active pipeline",
              style = MaterialTheme.typography.labelMedium,
              color = Color.White.copy(alpha = 0.72f),
            )
            Text(
              metrics.active.toString(),
              style = MaterialTheme.typography.headlineLarge.copy(fontSize = 28.sp, lineHeight = 32.sp),
              color = Color.White,
            )
          }
          Column(modifier = Modifier.weight(1f)) {
            Text(
              "Overdue",
              style = MaterialTheme.typography.labelMedium,
              color = Color.White.copy(alpha = 0.72f),
            )
            Text(
              metrics.overdue.toString(),
              style = MaterialTheme.typography.headlineLarge.copy(fontSize = 28.sp, lineHeight = 32.sp),
              color = Color.White,
            )
          }
          Column(modifier = Modifier.weight(1f)) {
            Text(
              "Today action",
              style = MaterialTheme.typography.labelMedium,
              color = Color.White.copy(alpha = 0.72f),
            )
            Text(
              metrics.today.toString(),
              style = MaterialTheme.typography.headlineLarge.copy(fontSize = 28.sp, lineHeight = 32.sp),
              color = Color.White,
            )
          }
        }
      }
    }

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      MetricCard(
        label = "Total leads",
        value = metrics.total.toString(),
        accent = MaterialTheme.colorScheme.onBackground,
        modifier = Modifier.weight(1f),
      )
      MetricCard(
        label = "Closed",
        value = metrics.closed.toString(),
        accent = Success500,
        modifier = Modifier.weight(1f),
      )
    }

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      MetricCard(
        label = "Renewal watch",
        value = metrics.renewalWatch.toString(),
        accent = MaterialTheme.colorScheme.secondary,
        modifier = Modifier.weight(1f),
      )
      MetricCard(
        label = "Action today",
        value = metrics.today.toString(),
        accent = Gold500,
        modifier = Modifier.weight(1f),
      )
    }

    if (pendingMeetings.isNotEmpty()) {
      Card(
        colors = CardDefaults.cardColors(containerColor = Danger500.copy(alpha = 0.10f)),
        border = BorderStroke(1.dp, Danger500.copy(alpha = 0.28f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text("Action required: past meetings", style = MaterialTheme.typography.titleMedium, color = Danger500)
          Text(
            "You have ${pendingMeetings.size} meetings pending a status update.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          Button(
            onClick = { onLeadClick(pendingMeetings.first().id) },
            modifier = Modifier.fillMaxWidth(),
          ) {
            Text("Review now")
          }
        }
      }
    }

    if (newLeads.isNotEmpty()) {
      Card(
        colors = CardDefaults.cardColors(containerColor = Gold500.copy(alpha = 0.10f)),
        border = BorderStroke(1.dp, Gold500.copy(alpha = 0.26f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("New leads (triage)", style = MaterialTheme.typography.titleMedium, color = Gold500)
          Text(
            "Update status in one tap. You can add more details later from the lead screen.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          triageError?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
          }
          Column(modifier = Modifier.fillMaxWidth()) {
            newLeads.forEachIndexed { idx, lead ->
              if (idx > 0) {
                Spacer(Modifier.height(10.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Spacer(Modifier.height(10.dp))
              }

              LeadMiniRow(lead = lead, onClick = { onLeadClick(lead.id) })

              val busy = triageBusyId == lead.id
              if (busy) {
                Spacer(Modifier.height(8.dp))
                Row(
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(10.dp),
                  modifier = Modifier.fillMaxWidth(),
                ) {
                  CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                  Text("Updating…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
              }

              Spacer(Modifier.height(10.dp))

              Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Button(
                  onClick = {
                    showDatePicker(ctx, initial = nowDate) { date ->
                      showTimePicker(ctx, initial = nowDateTime.toLocalTime().plusMinutes(30)) { time ->
                        val dt = LocalDateTime.of(date, time)
                        applyTriage(
                          lead = lead,
                          nextStatus = "Meeting Scheduled",
                          nextFollowUp = toIsoInstant(dt),
                          noteText =
                            "[Triage] Meeting scheduled for ${date} ${time.format(DateTimeFormatter.ofPattern("hh:mm a"))}.",
                        )
                      }
                    }
                  },
                  enabled = !busy,
                  modifier = Modifier.weight(1f),
                ) {
                  Text("Meeting", style = MaterialTheme.typography.labelMedium)
                }
                Button(
                  onClick = {
                    val dt = LocalDateTime.of(nowDate.plusDays(1), LocalTime.of(10, 0))
                    applyTriage(
                      lead = lead,
                      nextStatus = "Follow-Up Required",
                      nextFollowUp = toIsoInstant(dt),
                      noteText = "[Triage] Follow-up required. Next action set for tomorrow.",
                    )
                  },
                  enabled = !busy,
                  modifier = Modifier.weight(1f),
                ) {
                  Text("Follow-up", style = MaterialTheme.typography.labelMedium)
                }
              }

              Spacer(Modifier.height(10.dp))

              Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Button(
                  onClick = {
                    val dt = LocalDateTime.of(nowDate.plusDays(1), LocalTime.of(10, 0))
                    applyTriage(
                      lead = lead,
                      nextStatus = "Partner Follow-Up",
                      nextFollowUp = toIsoInstant(dt),
                      noteText = "[Triage] Partner follow-up required. Next action set for tomorrow.",
                    )
                  },
                  enabled = !busy,
                  modifier = Modifier.weight(1f),
                ) {
                  Text("Partner FU", style = MaterialTheme.typography.labelMedium)
                }
                Button(
                  onClick = {
                    val dt = LocalDateTime.of(nowDate.plusDays(15), LocalTime.of(10, 0))
                    applyTriage(
                      lead = lead,
                      nextStatus = "Interest Rate Issue",
                      nextFollowUp = toIsoInstant(dt),
                      noteText = "[Triage] Interest rate issue. Follow-up set in 15 days.",
                    )
                  },
                  enabled = !busy,
                  modifier = Modifier.weight(1f),
                ) {
                  Text("Rate issue", style = MaterialTheme.typography.labelMedium)
                }
              }

              Spacer(Modifier.height(10.dp))

              Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Button(
                  onClick = {
                    val dt = LocalDateTime.of(nowDate.plusDays(5), LocalTime.of(10, 0))
                    applyTriage(
                      lead = lead,
                      nextStatus = "No Appointment",
                      nextFollowUp = toIsoInstant(dt),
                      noteText = "[Triage] No appointment. Follow-up set in 5 days.",
                    )
                  },
                  enabled = !busy,
                  modifier = Modifier.weight(1f),
                ) {
                  Text("No appt", style = MaterialTheme.typography.labelMedium)
                }
                Button(
                  onClick = {
                    val dt = LocalDateTime.of(nowDate.plusDays(7), LocalTime.of(10, 0))
                    applyTriage(
                      lead = lead,
                      nextStatus = "Commercial Client",
                      nextFollowUp = toIsoInstant(dt),
                      noteText = "[Triage] Marked as Commercial Client. Field visit pending.",
                    )
                  },
                  enabled = !busy,
                  modifier = Modifier.weight(1f),
                ) {
                  Text("Commercial", style = MaterialTheme.typography.labelMedium)
                }
              }

              Spacer(Modifier.height(10.dp))

              Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Button(
                  onClick = { onLeadClick(lead.id) },
                  enabled = !busy,
                  modifier = Modifier.weight(1f),
                ) {
                  Text("Payment", style = MaterialTheme.typography.labelMedium)
                }
                Button(
                  onClick = {
                    val dt = LocalDateTime.of(nowDate.plusDays(180), LocalTime.of(10, 0))
                    applyTriage(
                      lead = lead,
                      nextStatus = "Not Eligible",
                      nextFollowUp = toIsoInstant(dt),
                      noteText = "[Triage] Marked Not Eligible (reason pending).",
                    )
                  },
                  enabled = !busy,
                  modifier = Modifier.weight(1f),
                ) {
                  Text("Reject", style = MaterialTheme.typography.labelMedium)
                }
              }
            }
          }
        }
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Upcoming meetings", style = MaterialTheme.typography.titleMedium)
        Text(
          "Meetings scheduled for today / tomorrow (India time).",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (upcomingMeetings.isEmpty()) {
          Text(
            "No upcoming meetings found.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          upcomingMeetings.forEachIndexed { idx, lead ->
            if (idx > 0) Spacer(Modifier.height(10.dp))
            LeadMiniRow(lead = lead, onClick = { onLeadClick(lead.id) })
          }
        }
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Text(
            "EOD clearance",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onPrimary,
            modifier = Modifier.weight(1f),
          )
          Text(
            text = pendingEod.toString(),
            style = MaterialTheme.typography.titleLarge,
            color = Gold500,
          )
        }
        Text(
          "Pending leads that haven’t been updated today (India time).",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f),
        )
        Button(
          onClick = onOpenEod,
          modifier = Modifier.fillMaxWidth(),
          colors =
            ButtonDefaults.buttonColors(
              containerColor = MaterialTheme.colorScheme.onPrimary,
              contentColor = MaterialTheme.colorScheme.primary,
            ),
        ) {
          Text("Open EOD")
        }
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Icon(Icons.Outlined.Group, contentDescription = null)
          Spacer(Modifier.width(10.dp))
          Text("Daily partner connect", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
          Text(todayKey, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(
          "Log today’s call / WhatsApp / meeting per mediator. Resets at midnight (India time).",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (callLogAutomationEnabled) {
          Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
          ) {
            Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
              Text("Call-log automation", style = MaterialTheme.typography.titleSmall)
              Text(
                "Optional: import your phone call logs to automatically mark “Call” for mediators.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )

              val lastSyncLabel =
                callLogLastSyncAt
                  ?.let { isoToKolkataLocalDateTime(it) }
                  ?.format(DateTimeFormatter.ofPattern("d MMM, hh:mm a"))

              if (!callLogGranted) {
                Button(
                  onClick = { callLogPermissionLauncher.launch(callLogPermission) },
                  modifier = Modifier.fillMaxWidth(),
                ) {
                  Text("Enable call-log access")
                }
              } else {
                Row(
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(10.dp),
                  modifier = Modifier.fillMaxWidth(),
                ) {
                  Button(
                    onClick = { syncMediatorCallsFromDeviceLog(silent = false) },
                    enabled = !callLogBusy,
                    modifier = Modifier.weight(1f),
                  ) {
                    Text("Sync now")
                  }
                  if (callLogBusy) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                  }
                }

                Text(
                  "Last sync: ${lastSyncLabel ?: "—"}",
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
              }

              callLogError?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
              }
            }
          }
        }

        partnerError?.let {
          Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }

        if (activeMediators.isEmpty()) {
          Text(
            "No mediators found. Add from the Mediators tab.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          Column(modifier = Modifier.fillMaxWidth()) {
            activeMediators.take(12).forEachIndexed { idx, m ->
              if (idx > 0) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
              }

              val doneEntry = m.followUpHistory.firstOrNull { it.date == todayKey }
              val isDone = doneEntry != null
              val isBusy = partnerBusyId == m.id

              Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
              ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                  Text(m.name, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onBackground)
                  val meta =
                    if (isDone) "Logged: ${doneEntry?.time ?: "--"} • ${doneEntry?.type ?: ""}"
                    else "Total connects: ${m.followUpHistory.size}"
                  Text(
                    meta,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                  )
                }

                if (isBusy) {
                  CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                  if (isDone) {
                    IconButton(onClick = { updatePartnerConnect(m, null) }) {
                      Icon(Icons.Outlined.Undo, contentDescription = "Undo")
                    }
                  } else {
                    IconButton(
                      onClick = {
                        val phone = m.phone.orEmpty()
                        if (phone.isNotBlank()) openDial(phone)
                        updatePartnerConnect(m, "call")
                      },
                      enabled = !m.phone.isNullOrBlank(),
                    ) {
                      Icon(Icons.Outlined.Call, contentDescription = "Call")
                    }
                    IconButton(
                      onClick = {
                        val phone = m.phone.orEmpty()
                        if (phone.isNotBlank()) {
                          val msg =
                            "Good Morning ${m.name}, hope you're doing well. Do we have any new cases or updates for today?"
                          openWhatsApp(phone, msg)
                        }
                        updatePartnerConnect(m, "whatsapp")
                      },
                      enabled = !m.phone.isNullOrBlank(),
                    ) {
                      Icon(Icons.Outlined.Chat, contentDescription = "WhatsApp")
                    }
                    IconButton(onClick = { updatePartnerConnect(m, "meeting") }) {
                      Icon(Icons.Outlined.MeetingRoom, contentDescription = "Meeting")
                    }
                  }
                }
              }
            }
          }

          if (activeMediators.size > 12) {
            Text(
              "Showing 12 mediators. See the Mediators tab for the full list.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
        }
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Text("Monthly sales target", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
          Text(
            monthlyKey,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }

        if (editingTarget) {
          OutlinedTextField(
            value = targetDraft,
            onValueChange = { targetDraft = it },
            label = { Text("Target (₹)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
	            colors =
	              TextFieldDefaults.colors(
	                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
	                focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
	                focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
	                unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
	                focusedTextColor = MaterialTheme.colorScheme.onSurface,
	                unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
	              ),
            modifier = Modifier.fillMaxWidth(),
          )
          Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            TextButton(
              onClick = {
                editingTarget = false
                targetDraft = target.toString()
              },
              modifier = Modifier.weight(1f),
            ) {
              Text("Cancel")
            }
            Button(
              onClick = {
                val next = targetDraft.trim().toLongOrNull()
                if (next != null && next > 0) {
                  target = next
                  editingTarget = false
                }
              },
              modifier = Modifier.weight(1f),
            ) {
              Text("Save")
            }
          }
        } else {
          Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            StatBlock(label = "Target", value = formatCompactInr(monthlyStats.target), modifier = Modifier.weight(1f))
            StatBlock(label = "Achieved", value = formatCompactInr(monthlyStats.achieved), modifier = Modifier.weight(1f))
          }
          LinearProgressIndicator(
            progress = monthlyStats.percentage / 100f,
            modifier = Modifier.fillMaxWidth(),
          )
          Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            StatBlock(label = "Pipeline", value = formatCompactInr(monthlyStats.pipeline), modifier = Modifier.weight(1f))
            StatBlock(label = "Stuck", value = formatCompactInr(monthlyStats.stuck), modifier = Modifier.weight(1f))
          }
          TextButton(onClick = { editingTarget = true }) {
            Text("Edit target")
          }
        }
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Upcoming actions", style = MaterialTheme.typography.titleMedium)
        if (metrics.upcoming.isEmpty()) {
          Text(
            "No upcoming follow-ups found.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          metrics.upcoming.take(6).forEachIndexed { idx, lead ->
            if (idx > 0) Spacer(Modifier.height(10.dp))
            LeadMiniRow(lead = lead, onClick = { onLeadClick(lead.id) })
          }
        }
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Recent activity", style = MaterialTheme.typography.titleMedium)
        Text(
          "Last updated leads (latest first).",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (recentActivity.isEmpty()) {
          Text(
            "No recent activity found.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          recentActivity.forEachIndexed { idx, lead ->
            if (idx > 0) Spacer(Modifier.height(10.dp))
            LeadMiniRow(lead = lead, onClick = { onLeadClick(lead.id) })
          }
        }
      }
    }

    Spacer(Modifier.height(6.dp))
  }
}

private data class MonthlyTargetStats(
  val target: Long,
  val achieved: Long,
  val pipeline: Long,
  val stuck: Long,
  val percentage: Int,
)

@Composable
private fun StatBlock(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(value, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onBackground)
    }
  }
}

@Composable
private fun MetricCard(
  label: String,
  value: String,
  accent: Color,
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier,
    shape = MaterialTheme.shapes.large,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
      Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(value, style = MaterialTheme.typography.headlineSmall, color = accent)
    }
  }
}

private data class DashboardMetrics(
  val total: Int,
  val active: Int,
  val closed: Int,
  val today: Int,
  val overdue: Int,
  val renewalWatch: Int,
  val upcoming: List<LeadSummary>,
)

private fun computeMetrics(leads: List<LeadSummary>): DashboardMetrics {
  val closedStatuses = setOf("Payment Done", "Deal Closed")
  val rejectedStatuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor")
  val actionable = leads.filterNot { (it.status ?: "") in closedStatuses || (it.status ?: "") in rejectedStatuses }

  val today = LocalDate.now(KOLKATA_ZONE)

  val todayCount =
    actionable.count {
      val d = isoToKolkataDate(it.nextFollowUp)
      d != null && d.isEqual(today)
    }

  val overdueCount =
    actionable.count {
      val d = isoToKolkataDate(it.nextFollowUp)
      d != null && d.isBefore(today)
    }

  val closed = leads.count { (it.status ?: "") in closedStatuses }
  val active = (leads.size - closed - leads.count { (it.status ?: "") in rejectedStatuses }).coerceAtLeast(0)

  val renewalWatch =
    leads.count {
      (it.status ?: "") == "Payment Done" &&
        isoToKolkataDate(it.nextFollowUp)?.let { d ->
          val days = ChronoUnit.DAYS.between(today, d)
          days in 0..30
        } == true
    }

  val upcoming =
    actionable
      .mapNotNull { l ->
        val d = isoToKolkataDate(l.nextFollowUp) ?: return@mapNotNull null
        l to d
      }
      .filter { (_, d) -> !d.isBefore(today) }
      .sortedBy { (_, d) -> d }
      .map { (l, _) -> l }

  return DashboardMetrics(
    total = leads.size,
    active = active,
    closed = closed,
    today = todayCount,
    overdue = overdueCount,
    renewalWatch = renewalWatch,
    upcoming = upcoming,
  )
}

private fun parseLocalDate(raw: String?): LocalDate? {
  return isoToKolkataDate(raw)
}
