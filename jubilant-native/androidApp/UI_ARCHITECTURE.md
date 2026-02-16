# Jubilant Native Android UI Architecture

## Goals
- Premium, staff-first fintech UI with dark-first theme.
- Keep all existing feature modules accessible.
- Reuse shared data models and API contracts from `shared/`.

## Package layout
- `androidApp/src/main/java/com/jubilant/lirasnative/ui/designsystem/tokens/`
  - `AppColorTokens.kt`
  - `AppTypographyTokens.kt`
  - `AppSpacing.kt`
  - `AppRadius.kt`
  - `AppMotion.kt`
- `androidApp/src/main/java/com/jubilant/lirasnative/ui/designsystem/components/`
  - `PremiumComponents.kt`
- `androidApp/src/main/java/com/jubilant/lirasnative/ui/screens/premium/`
  - `PremiumSampleScreens.kt` (home, leads, underwriting evidence, PD)

## Navigation shell
Bottom navigation is now fixed to:
1. Home (`dashboard`)
2. Leads (`leads`)
3. Collections (`collections`)
4. More (`more`)

`More` routes keep all major modules discoverable:
- Underwriting
- Statement Autopilot
- PD
- Loan Book
- Reports
- Network
- Tasks
- Activities
- Settings
- Admin Tools

## Network reorganization
`crm_network` now supports tabs via argument:
- `Partners`
- `Mediators`
- `Tasks`
- `Activities`

This keeps Partners + Mediators together under Network while preserving tasks/activities workflows.

## Theme + tokens
- `ui/theme/Color.kt` now sources all palette values from design-system tokens.
- `ui/theme/Type.kt` maps Material text styles to numeric-first typography tokens.
- `ui/theme/Shape.kt` maps shapes to tokenized radii.

## Rollout strategy
1. Keep existing route contracts unchanged.
2. Replace visual shell first (theme, top bar, bottom nav, module IA).
3. Incrementally migrate each existing screen to tokenized components.
