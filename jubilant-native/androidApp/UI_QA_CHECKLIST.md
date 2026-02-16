# Jubilant Android UI QA Checklist

## Usability
- [ ] Bottom nav has exactly 4 items: Home, Leads, Collections, More.
- [ ] More screen exposes Underwriting, Loan Book, Reports, Network, Tasks, Activities, Settings, Admin Tools.
- [ ] Network shows both Partners and Mediators tabs.
- [ ] Home top bar shows brand, user identity, sync status.
- [ ] Numeric hierarchy is readable (portfolio, section titles, card values, labels, helper text).
- [ ] Lead rows remain scannable on small devices.
- [ ] Right-aligned numeric columns in evidence/table views.
- [ ] Accordion sections preserve completion + autosave context.

## Functional continuity
- [ ] Existing lead detail/edit/create routes still work.
- [ ] Underwriting -> PD flow still works.
- [ ] Statement Autopilot route remains reachable.
- [ ] Collections queue and EOD links still work.
- [ ] Search route remains reachable from shell.
- [ ] Settings and Admin routes remain reachable.

## Offline + sync
- [ ] Offline/poor/online status renders correctly.
- [ ] Pending retry queue count is visible in status banner.
- [ ] Sync-now action still triggers retry scheduler.

## Motion + loading
- [ ] Expansion/collapse transitions are <200ms and responsive.
- [ ] Skeleton placeholders render without visual stutter.
- [ ] Ripple/tap feedback is visible on interactive rows.

## Performance
- [ ] Cold start to first interactive screen under target budget.
- [ ] Scroll on long lead/collections lists is smooth on mid-tier devices.
- [ ] No excessive recomposition spikes in dashboard and network tabs.

## Security + privacy
- [ ] Biometric lock flow still blocks app when enabled.
- [ ] Secure-screen setting still hides app switcher preview.

## Regression gates
- [ ] Compile succeeds with supported JDK/Android SDK.
- [ ] Smoke test completed across Home, Leads, Collections, More.
- [ ] No route dead-ends from primary navigation paths.
