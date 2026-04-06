include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-mibox-ui
PKG_VERSION:=0.0.3
PKG_RELEASE:=1

PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Ang3el <opensource@ang3el.world>

LUCI_TITLE:=LuCI Mibox UI
LUCI_DEPENDS:=+luci-base +luci-compat +coreutils-base64 +kmod-tun +curl +jq
LUCI_PKGARCH:=all
LUCI_LANG.en:=English
LUCI_LANG.ru:=Russian
LUCI_LANGUAGES:=en ru

include $(TOPDIR)/feeds/luci/luci.mk

define Build/Compile
	@mkdir -p $(PKG_BUILD_DIR)/po/ru
	@if [ -f "./po/ru/mibox-ui.po" ]; then \
		$(STAGING_DIR_HOSTPKG)/bin/po2lmo \
			"./po/ru/mibox-ui.po" \
			"$(PKG_BUILD_DIR)/po/ru/mibox-ui.lmo"; \
	fi
	@mkdir -p $(PKG_BUILD_DIR)/po/en
	@if [ -f "./po/en/mibox-ui.po" ]; then \
		$(STAGING_DIR_HOSTPKG)/bin/po2lmo \
			"./po/en/mibox-ui.po" \
			"$(PKG_BUILD_DIR)/po/en/mibox-ui.lmo"; \
	fi
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/mibox-ui $(1)/etc/config/

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/mibox-ui $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface
	$(INSTALL_BIN) ./root/etc/hotplug.d/iface/40-mibox $(1)/etc/hotplug.d/iface/
	$(INSTALL_DIR) $(1)/etc/hotplug.d/net
	$(INSTALL_BIN) ./root/etc/hotplug.d/net/99-mibox-tun $(1)/etc/hotplug.d/net/

	$(INSTALL_DIR) $(1)/etc/mibox
	$(INSTALL_DATA) ./root/etc/mibox/config.yaml $(1)/etc/mibox/

	$(INSTALL_DIR) $(1)/usr/bin/mibox-ui
	$(INSTALL_BIN) ./root/usr/bin/mibox-ui/mibox-ui-helper $(1)/usr/bin/mibox-ui/
	$(INSTALL_BIN) ./root/usr/bin/mibox-ui/mibox-ui-apply-settings $(1)/usr/bin/mibox-ui/
	$(INSTALL_BIN) ./root/usr/bin/mibox-ui/mibox-ui-subscription $(1)/usr/bin/mibox-ui/

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-mibox-ui.json $(1)/usr/share/luci/menu.d/

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-mibox-ui.json $(1)/usr/share/rpcd/acl.d/

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/mibox-ui
	$(CP) ./htdocs/luci-static/resources/view/mibox-ui/* $(1)/www/luci-static/resources/view/mibox-ui/

	@if [ -f "$(PKG_BUILD_DIR)/po/ru/mibox-ui.lmo" ] || [ -f "$(PKG_BUILD_DIR)/po/en/mibox-ui.lmo" ]; then \
		$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n; \
	fi
	@if [ -f "$(PKG_BUILD_DIR)/po/ru/mibox-ui.lmo" ]; then \
		$(INSTALL_DATA) "$(PKG_BUILD_DIR)/po/ru/mibox-ui.lmo" \
			"$(1)/usr/lib/lua/luci/i18n/mibox-ui.ru.lmo"; \
	fi
	@if [ -f "$(PKG_BUILD_DIR)/po/en/mibox-ui.lmo" ]; then \
		$(INSTALL_DATA) "$(PKG_BUILD_DIR)/po/en/mibox-ui.lmo" \
			"$(1)/usr/lib/lua/luci/i18n/mibox-ui.en.lmo"; \
	fi
endef

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,$(PKG_NAME)))
