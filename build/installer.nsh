!macro runShortcutOwnership ACTION REQUESTED
  InitPluginsDir
  File /oname=$PLUGINSDIR\shortcutOwnership.ps1 "${BUILD_RESOURCES_DIR}\shortcutOwnership.ps1"
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_SHORTCUT_ACTION", w "${ACTION}") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_SHORTCUT_REQUESTED", w "${REQUESTED}") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_SHORTCUT_PATH", w "$DESKTOP\${SHORTCUT_NAME}.lnk") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_SHORTCUT_TARGET", w "$INSTDIR\${APP_EXECUTABLE_FILENAME}") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_SHORTCUT_MARKER", w "$INSTDIR\.spellbook-desktop-shortcut-owner.json") i .r1'
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\shortcutOwnership.ps1"'
  Pop $0
  ${if} $0 != 0
    DetailPrint "Spellbook desktop shortcut ownership operation failed with exit code $0; the shortcut was preserved."
  ${endIf}
!macroend

!macro customInstall
  ${if} ${isNoDesktopShortcut}
    !insertmacro runShortcutOwnership "install" "false"
  ${else}
    !insertmacro runShortcutOwnership "install" "true"
  ${endIf}
!macroend

!macro customUnInstall
  !insertmacro runShortcutOwnership "uninstall" "true"
!macroend
