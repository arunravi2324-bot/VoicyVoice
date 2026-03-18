FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS dashboard-build
ARG VITE_CONVEX_URL
COPY dashboard/package.json dashboard/bun.lock* dashboard/
COPY convex/ convex/
RUN cd dashboard && bun install --frozen-lockfile
COPY dashboard/ dashboard/
RUN cd dashboard && VITE_CONVEX_URL=$VITE_CONVEX_URL bun run build

FROM base AS server-deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

FROM base
COPY --from=server-deps /app/node_modules node_modules
COPY package.json ./
COPY src/ src/
COPY convex/ convex/
COPY assets/ assets/
COPY --from=dashboard-build /app/dashboard/dist dashboard/dist

ENV NODE_ENV=production
EXPOSE 5050

CMD ["bun", "run", "src/index.ts"]
