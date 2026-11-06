# Serves the built demo site. The deploy job builds the site into root/ before the image build,
# from the packages in this repository, not from npm.
# No RUN step, so each target architecture builds without emulation.
FROM caddy:2.9.1-alpine
WORKDIR /site/logs
WORKDIR /site
COPY Caddyfile /etc/caddy/Caddyfile
COPY root ./root
