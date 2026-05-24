# Decision Log

**Architectural Decision:** Adopt a **mobile‑first PWA** with full‑screen
standalone configuration using `@ducanh2912/next-pwa` instead of targeting
native app store listings. Rationale:

1. **Rapid Deployment** – No app store review cycles; instant updates.
2. **Cross‑Platform Reach** – Works on iOS, Android, and desktop browsers.
3. **Consistent UX** – Same codebase for web and mobile, reducing maintenance.
4. **Offline Support** – Service workers enable caching of static assets and
   critical data for a seamless experience.

All future feature work will be scoped with this PWA strategy in mind.
