#!/bin/sh

set -eu

MODE="${1:-}"

MIBOX_PKG_DIR="${MIBOX_PKG_DIR:-${MIBOX_IPK_DIR:-}}"
MIBOX_LUCI_PKG_URL="${MIBOX_LUCI_PKG_URL:-${MIBOX_LUCI_IPK_URL:-}}"
MIBOX_SKIP_PKG_UPDATE="${MIBOX_SKIP_PKG_UPDATE:-${MIBOX_SKIP_OPKG_UPDATE:-0}}"
MIBOX_RUNTIME_DEPS="${MIBOX_RUNTIME_DEPS:-}"
MIBOX_HEALTH_RETRIES="${MIBOX_HEALTH_RETRIES:-10}"
MIBOX_HEALTH_RETRY_DELAY="${MIBOX_HEALTH_RETRY_DELAY:-1}"
MIBOX_HEALTH_URL="${MIBOX_HEALTH_URL:-http://127.0.0.1/cgi-bin/luci/api/version}"
MIBOX_AUTO_RELEASE="${MIBOX_AUTO_RELEASE:-1}"
MIBOX_AUTO_RELEASE_STRICT="${MIBOX_AUTO_RELEASE_STRICT:-1}"
MIBOX_GITHUB_REPO="${MIBOX_GITHUB_REPO:-ang3el7z/luci-app-mibox-ui}"
MIBOX_GITHUB_API="${MIBOX_GITHUB_API:-https://api.github.com}"
MIBOX_VERSION="${MIBOX_VERSION:-latest}"
MIBOX_GITHUB_TOKEN="${MIBOX_GITHUB_TOKEN:-}"
MIBOX_SERVICE_NAME="${MIBOX_SERVICE_NAME:-mibox-ui}"

PKG_NAME="luci-app-mibox-ui"
PKG_MGR=""
PKG_EXT=""
INSTALL_STAGE="init"
PKG_INSTALLED=0
SERVICE_STARTED=0

log() {
	printf '%s\n' "[mibox-installer] $*"
}

fail() {
	printf '%s\n' "[mibox-installer] ERROR: $*" >&2
	exit 1
}

prompt_mode() {
	if [ -n "$MODE" ]; then
		return
	fi

	if [ -t 0 ] && [ -t 1 ]; then
		printf '%s\n' "[mibox-installer] Выберите действие:"
		printf '%s\n' "  1) install   - установить"
		printf '%s\n' "  2) update    - обновить"
		printf '%s\n' "  3) uninstall - удалить"
		while :; do
			printf '%s' "[mibox-installer] Введите 1/2/3: "
			if ! read -r choice; then
				fail "input aborted"
			fi
			case "$choice" in
				1|install)
					MODE="install"
					break
					;;
				2|update)
					MODE="update"
					break
					;;
				3|uninstall|remove)
					MODE="uninstall"
					break
					;;
				*)
					printf '%s\n' "[mibox-installer] Некорректный выбор, попробуйте снова."
					;;
			esac
		done
	else
		MODE="install"
	fi
}

normalize_mode() {
	case "$MODE" in
		remove)
			MODE="uninstall"
			;;
	esac
}

require_root() {
	[ "$(id -u)" = "0" ] || fail "run as root"
}

require_openwrt() {
	[ -f /etc/openwrt_release ] || fail "OpenWrt environment not detected (/etc/openwrt_release missing)"
}

strip_version_prefix() {
	value="$1"
	case "$value" in
		v*)
			printf '%s' "${value#v}"
			;;
		*)
			printf '%s' "$value"
			;;
	esac
}

github_api_get() {
	url="$1"

	if command -v curl >/dev/null 2>&1; then
		if [ -n "$MIBOX_GITHUB_TOKEN" ]; then
			curl -fsSL \
				-H "Accept: application/vnd.github+json" \
				-H "User-Agent: mibox-openwrt-installer" \
				-H "Authorization: Bearer $MIBOX_GITHUB_TOKEN" \
				"$url"
		else
			curl -fsSL \
				-H "Accept: application/vnd.github+json" \
				-H "User-Agent: mibox-openwrt-installer" \
				"$url"
		fi
		return $?
	fi

	if command -v wget >/dev/null 2>&1; then
		if [ -n "$MIBOX_GITHUB_TOKEN" ]; then
			wget -qO- \
				--header="Accept: application/vnd.github+json" \
				--header="User-Agent: mibox-openwrt-installer" \
				--header="Authorization: Bearer $MIBOX_GITHUB_TOKEN" \
				"$url"
		else
			wget -qO- \
				--header="Accept: application/vnd.github+json" \
				--header="User-Agent: mibox-openwrt-installer" \
				"$url"
		fi
		return $?
	fi

	if command -v uclient-fetch >/dev/null 2>&1; then
		uclient-fetch -qO- "$url"
		return $?
	fi

	return 127
}

asset_url_any() {
	release_json="$1"
	pkg_name="$2"
	pkg_ext="$3"
	suffix=".$pkg_ext"
	printf '%s' "$release_json" | jq -r \
		--arg pkg "$pkg_name" \
		--arg suffix "$suffix" \
		'.assets[]? | select(.name | startswith($pkg) and endswith($suffix)) | .browser_download_url' | head -n 1
}

resolve_release_package_url() {
	[ "$MIBOX_AUTO_RELEASE" = "1" ] || return 1

	command -v jq >/dev/null 2>&1 || return 1

	selector="$MIBOX_VERSION"
	if [ -z "$selector" ] || [ "$selector" = "latest" ]; then
		api_url="$MIBOX_GITHUB_API/repos/$MIBOX_GITHUB_REPO/releases/latest"
	else
		tag="$selector"
		case "$tag" in
			v*) ;;
			*) tag="v$tag" ;;
		esac
		api_url="$MIBOX_GITHUB_API/repos/$MIBOX_GITHUB_REPO/releases/tags/$tag"
	fi

	release_json="$(github_api_get "$api_url" 2>/dev/null || true)"
	[ -n "$release_json" ] || return 1

	release_tag="$(printf '%s' "$release_json" | jq -r '.tag_name // empty' | head -n 1)"
	[ -n "$release_tag" ] || return 1

	log "Resolving release asset: repo=$MIBOX_GITHUB_REPO version=$selector format=$PKG_EXT"
	url="$(asset_url_any "$release_json" "$PKG_NAME" "$PKG_EXT")"
	[ -n "$url" ] || return 1

	MIBOX_LUCI_PKG_URL="$url"
	log "Resolved release tag: $release_tag"
	log "Resolved package URL: $MIBOX_LUCI_PKG_URL"
	return 0
}

find_pkg_by_pattern() {
	dir="$1"
	pattern="$2"
	find "$dir" -maxdepth 1 -type f -name "$pattern" | sort | tail -n 1
}

detect_pkg_manager() {
	if [ -n "$MIBOX_PKG_DIR" ] && [ -d "$MIBOX_PKG_DIR" ]; then
		if find "$MIBOX_PKG_DIR" -maxdepth 1 -type f -name '*.apk' | grep -q .; then
			command -v apk >/dev/null 2>&1 || fail "Local .apk package detected, but apk is not available"
			PKG_MGR="apk"
			PKG_EXT="apk"
			return
		fi
		if find "$MIBOX_PKG_DIR" -maxdepth 1 -type f -name '*.ipk' | grep -q .; then
			command -v opkg >/dev/null 2>&1 || fail "Local .ipk package detected, but opkg is not available"
			PKG_MGR="opkg"
			PKG_EXT="ipk"
			return
		fi
	fi

	case "$MIBOX_LUCI_PKG_URL" in
		*.apk)
			command -v apk >/dev/null 2>&1 || fail "MIBOX_LUCI_PKG_URL points to .apk, but apk is not available"
			PKG_MGR="apk"
			PKG_EXT="apk"
			return
			;;
		*.ipk)
			command -v opkg >/dev/null 2>&1 || fail "MIBOX_LUCI_PKG_URL points to .ipk, but opkg is not available"
			PKG_MGR="opkg"
			PKG_EXT="ipk"
			return
			;;
	esac

	if command -v opkg >/dev/null 2>&1; then
		PKG_MGR="opkg"
		PKG_EXT="ipk"
		return
	fi

	if command -v apk >/dev/null 2>&1; then
		PKG_MGR="apk"
		PKG_EXT="apk"
		return
	fi

	fail "No supported package manager found (need opkg or apk)"
}

pkg_update_if_needed() {
	if [ "$MIBOX_SKIP_PKG_UPDATE" = "1" ]; then
		log "Skipping package index update (MIBOX_SKIP_PKG_UPDATE=1)"
		return
	fi

	case "$PKG_MGR" in
		opkg)
			log "Updating opkg indexes..."
			opkg update
			;;
		apk)
			log "Updating apk indexes..."
			apk update
			;;
		*)
			fail "Unknown package manager: $PKG_MGR"
			;;
	esac
}

pkg_is_installed() {
	dep="$1"
	case "$PKG_MGR" in
		opkg)
			opkg list-installed "$dep" 2>/dev/null | grep -q "^$dep -"
			;;
		apk)
			apk info -e "$dep" >/dev/null 2>&1
			;;
		*)
			return 1
			;;
	esac
}

pkg_install_dep() {
	dep="$1"
	case "$PKG_MGR" in
		opkg)
			opkg install "$dep"
			;;
		apk)
			apk add "$dep"
			;;
		*)
			fail "Unknown package manager: $PKG_MGR"
			;;
	esac
}

pkg_install_local_or_url() {
	case "$PKG_MGR" in
		opkg)
			opkg install "$@"
			;;
		apk)
			apk add --allow-untrusted "$@"
			;;
		*)
			fail "Unknown package manager: $PKG_MGR"
			;;
	esac
}

pkg_install_from_repo() {
	case "$PKG_MGR" in
		opkg)
			opkg install "$PKG_NAME"
			;;
		apk)
			apk add "$PKG_NAME"
			;;
		*)
			fail "Unknown package manager: $PKG_MGR"
			;;
	esac
}

pkg_remove() {
	case "$PKG_MGR" in
		opkg)
			opkg remove "$PKG_NAME" || true
			;;
		apk)
			apk del "$PKG_NAME" || true
			;;
		*)
			fail "Unknown package manager: $PKG_MGR"
			;;
	esac
}

ensure_runtime_deps() {
	deps="$MIBOX_RUNTIME_DEPS"
	if [ -z "$deps" ]; then
		case "$PKG_MGR" in
			opkg) deps="ca-bundle curl jq" ;;
			apk) deps="ca-certificates curl jq" ;;
			*) deps="" ;;
		esac
	fi

	[ -n "$deps" ] || return
	log "Ensuring runtime dependencies: $deps"
	for dep in $deps; do
		if pkg_is_installed "$dep"; then
			continue
		fi
		log "Installing dependency: $dep"
		pkg_install_dep "$dep"
	done
}

install_packages() {
	if [ -n "$MIBOX_PKG_DIR" ]; then
		[ -d "$MIBOX_PKG_DIR" ] || fail "MIBOX_PKG_DIR not found: $MIBOX_PKG_DIR"

		luci_pkg="$(find_pkg_by_pattern "$MIBOX_PKG_DIR" "*${PKG_NAME}*.$PKG_EXT")"
		[ -n "$luci_pkg" ] || fail "${PKG_NAME} package (*.$PKG_EXT) not found in $MIBOX_PKG_DIR"

		log "Installing local package: $luci_pkg"
		pkg_install_local_or_url "$luci_pkg"
		PKG_INSTALLED=1
		return
	fi

	if [ -z "$MIBOX_LUCI_PKG_URL" ] && [ "$MIBOX_AUTO_RELEASE" = "1" ]; then
		if ! resolve_release_package_url; then
			if [ "$MIBOX_AUTO_RELEASE_STRICT" = "1" ]; then
				fail "Failed to resolve package URL from GitHub release (repo=$MIBOX_GITHUB_REPO version=$MIBOX_VERSION format=$PKG_EXT)"
			fi
			log "Auto-release URL resolution failed, falling back to package feed install"
		fi
	fi

	if [ -n "$MIBOX_LUCI_PKG_URL" ]; then
		log "Installing package from URL: $MIBOX_LUCI_PKG_URL"
		pkg_install_local_or_url "$MIBOX_LUCI_PKG_URL"
		PKG_INSTALLED=1
		return
	fi

	log "Installing package from configured feeds..."
	pkg_install_from_repo
	PKG_INSTALLED=1
}

service_enable_start() {
	if [ ! -x "/etc/init.d/$MIBOX_SERVICE_NAME" ]; then
		log "Service script not found: /etc/init.d/$MIBOX_SERVICE_NAME (skip start)"
		return
	fi
	log "Enabling and starting $MIBOX_SERVICE_NAME..."
	"/etc/init.d/$MIBOX_SERVICE_NAME" enable || true
	"/etc/init.d/$MIBOX_SERVICE_NAME" restart || "/etc/init.d/$MIBOX_SERVICE_NAME" start
	SERVICE_STARTED=1
}

service_stop_disable() {
	if [ -x "/etc/init.d/$MIBOX_SERVICE_NAME" ]; then
		log "Stopping and disabling $MIBOX_SERVICE_NAME..."
		"/etc/init.d/$MIBOX_SERVICE_NAME" stop || true
		"/etc/init.d/$MIBOX_SERVICE_NAME" disable || true
	fi
}

dump_diagnostics() {
	log "Diagnostics snapshot begin"
	if [ -x "/etc/init.d/$MIBOX_SERVICE_NAME" ]; then
		log "Init status:"
		status_out="$("/etc/init.d/$MIBOX_SERVICE_NAME" status 2>&1 || true)"
		[ -n "$status_out" ] && printf '%s\n' "$status_out"
	fi

	if command -v logread >/dev/null 2>&1; then
		log "Recent logread lines (grep: mibox|mihomo|clash):"
		logread 2>/dev/null | grep -Ei 'mibox|mihomo|clash' | tail -n 50 || true
	fi
	log "Diagnostics snapshot end"
}

fetch_url() {
	url="$1"
	if command -v curl >/dev/null 2>&1; then
		curl -fsS --max-time 5 "$url"
		return $?
	fi
	if command -v wget >/dev/null 2>&1; then
		wget -qO- --timeout=5 "$url"
		return $?
	fi
	if command -v uclient-fetch >/dev/null 2>&1; then
		uclient-fetch -qO- "$url"
		return $?
	fi
	return 127
}

post_check() {
	url="$MIBOX_HEALTH_URL"
	retries="$MIBOX_HEALTH_RETRIES"
	delay="$MIBOX_HEALTH_RETRY_DELAY"

	case "$retries" in ''|*[!0-9]*) retries=10 ;; esac
	case "$delay" in ''|*[!0-9]*) delay=1 ;; esac

	log "Post-check: requesting $url (retries=$retries, delay=${delay}s)"
	attempt=1
	last_out=""

	while [ "$attempt" -le "$retries" ]; do
		if out="$(fetch_url "$url" 2>/dev/null)"; then
			if printf '%s' "$out" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
				log "API check: OK"
				return
			fi
			if printf '%s' "$out" | grep -q 'Unauthorized'; then
				log "API reachable (auth may be enabled)."
				return
			fi
			last_out="$out"
		fi

		if [ "$attempt" -lt "$retries" ] && [ "$delay" -gt 0 ]; then
			sleep "$delay"
		fi
		attempt=$((attempt + 1))
	done

	if [ -n "$last_out" ]; then
		log "API response received but not successful:"
		printf '%s\n' "$last_out"
	else
		log "API unavailable (uhttpd/LuCI may still be starting)"
	fi

	dump_diagnostics
}

rollback_install() {
	log "Install rollback (best effort)..."
	if [ "$SERVICE_STARTED" = "1" ]; then
		service_stop_disable
	fi
	if [ "$PKG_INSTALLED" = "1" ]; then
		pkg_remove
	fi
}

install_failure_trap() {
	rc="$?"
	trap - EXIT INT TERM HUP
	if [ "$rc" -ne 0 ]; then
		log "Install failed at stage: $INSTALL_STAGE"
		rollback_install
		dump_diagnostics
		exit "$rc"
	fi
}

install_mode() {
	trap 'install_failure_trap' EXIT INT TERM HUP
	INSTALL_STAGE="pkg-update"
	pkg_update_if_needed
	INSTALL_STAGE="deps"
	ensure_runtime_deps
	INSTALL_STAGE="package-install"
	install_packages
	INSTALL_STAGE="service-start"
	service_enable_start
	INSTALL_STAGE="post-check"
	post_check
	trap - EXIT INT TERM HUP
	log "Install completed"
}

repair_mode() {
	service_enable_start
	post_check
	log "Repair completed"
}

uninstall_mode() {
	service_stop_disable
	log "Removing package..."
	pkg_remove
	log "Uninstall completed"
}

main() {
	prompt_mode
	normalize_mode
	require_root
	require_openwrt
	detect_pkg_manager
	log "Detected package manager: $PKG_MGR"

	case "$MODE" in
		install)
			install_mode
			;;
		update)
			install_mode
			;;
		repair)
			repair_mode
			;;
		uninstall)
			uninstall_mode
			;;
		*)
			fail "unknown mode: $MODE (use: install|update|repair|uninstall)"
			;;
	esac
}

main "$@"
