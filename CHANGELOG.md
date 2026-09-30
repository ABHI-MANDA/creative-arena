# Changelog

Notable changes to M & A Creative Arena are recorded here. The project does not currently publish versioned releases.

## Unreleased

### Added

- Filterable Admin Console report with JSON summaries and CSV download for properties, campaigns, assets, and generation events.
- Persistent light/dark lighting mode with higher-contrast color tokens and green-gradient surfaces/actions.
- Property loading recovery for campaign creation, including stale deep-link selection handling and retry/error states.
- Separate production, API, and database guides.

### Changed

- Drizzle Kit configuration now loads `DATABASE_URL` from the environment instead of targeting a hard-coded local database.
- Root README is organized as a project overview and documentation entry point.

### Known limitations

- No built-in authentication/authorization.
- Server-side persistent image/ZIP exports require local JSON mode; production object storage is not implemented.
- Reel generation creates storyboards/scripts, not MP4 video.
