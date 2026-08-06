# render-service/Dockerfile
#
# ★ BUILD BUT DO NOT DEPLOY (Phase 37 owner instruction). This file is authored and reviewed
# as text only — `docker build` is not run against it this phase. See 37-CONTEXT.md.
#
# Two-stage build. A single-stage `npm ci --omit=dev` then `npm run build` (as sketched in
# 37-RESEARCH.md) does NOT work: `typescript` is a devDependency, so `tsc` would be absent
# from an --omit=dev install. The builder stage below runs a full `npm ci` so `tsc` exists,
# then only the compiled `lib/` output is copied into the lean runtime stage.

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

# LibreOffice's Impress component covers PPTX->PDF export; poppler-utils gives pdftoppm.
# ★ Only metric-compatible OPEN fonts — never ttf-mscorefonts-installer / msttcorefonts
# (R062 criterion 3, a licensing constraint, not a preference). --no-install-recommends is
# load-bearing, not style: without it a recommends chain can pull a font package in behind
# your back.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-impress \
      poppler-utils \
      fonts-crosextra-carlito \
      fonts-crosextra-caladea \
      fonts-liberation \
      fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Font AVAILABILITY (the apt install above) is not the same thing as font SUBSTITUTION —
# installing fonts-crosextra-carlito makes the glyphs available, but LibreOffice still needs
# to be told that a document's declared "Calibri" should resolve to "Carlito". This alias
# file closes that gap (37-RESEARCH.md Pitfall 2 / assumption A4). Order matters: the
# fontconfig cache must be rebuilt AFTER the alias file lands, not before.
COPY fontconfig/60-metric-compat-aliases.conf /etc/fonts/conf.d/60-metric-compat-aliases.conf
RUN fc-cache -f

# ★ Testable font-provenance assertion (criterion 3): fail the BUILD if a future base-image
# or transitive-dependency change ever pulls in Microsoft core fonts. This is the "assertion,
# not an intention" the phase requires -- it runs at `docker build` time, catching drift
# before an image is ever pushed. It runs at build time; this run does not build.
RUN if dpkg -l 2>/dev/null | grep -qiE 'mscorefonts|msttcorefonts'; then \
      echo "FATAL: Microsoft font package detected -- licensing violation" >&2; \
      exit 1; \
    fi

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/lib ./lib

# Cloud Run's writable path is /tmp (memory-backed, counts against --memory). LibreOffice's
# profile MUST live under a writable, per-request-unique path -- never the default $HOME,
# which is not guaranteed writable in this image (37-RESEARCH.md Pitfall 3).
ENV HOME=/tmp
ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", "lib/main.js"]
