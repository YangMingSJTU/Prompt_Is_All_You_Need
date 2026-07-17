!ifndef BUILD_UNINSTALLER
  Var spellbookRegistrationPrepared
  Var spellbookInstallCommitted
  !define MUI_CUSTOMFUNCTION_ABORT SpellbookRollbackInstallationRegistry
!endif

!macro runShortcutOwnership ACTION REQUESTED SHORTCUT_PATH MARKER_NAME
  InitPluginsDir
  File /oname=$PLUGINSDIR\shortcutOwnership.ps1 "${BUILD_RESOURCES_DIR}\shortcutOwnership.ps1"
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_SHORTCUT_ACTION", w "${ACTION}") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_SHORTCUT_REQUESTED", w "${REQUESTED}") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_SHORTCUT_PATH", w "${SHORTCUT_PATH}") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_SHORTCUT_TARGET", w "$INSTDIR\${APP_EXECUTABLE_FILENAME}") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_SHORTCUT_MARKER", w "$INSTDIR\${MARKER_NAME}") i .r1'
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\shortcutOwnership.ps1"'
  Pop $0
  ${if} $0 != 0
    DetailPrint "Spellbook shortcut ownership operation failed with exit code $0; the shortcut was preserved."
  ${endIf}
!macroend

!macro runInstallationRegistry ACTION
  InitPluginsDir
  File /oname=$PLUGINSDIR\installationRegistry.ps1 "${BUILD_RESOURCES_DIR}\installationRegistry.ps1"
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_INSTALL_ACTION", w "${ACTION}") i .r1'
  ${if} $installMode == "all"
    System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_INSTALL_ROOT", w "HKLM") i .r1'
  ${else}
    System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_INSTALL_ROOT", w "HKCU") i .r1'
  ${endIf}
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_INSTALL_KEY", w "${INSTALL_REGISTRY_KEY}") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_UNINSTALL_KEY", w "${UNINSTALL_REGISTRY_KEY}") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_INSTANCES_KEY", w "${INSTALL_REGISTRY_KEY}.Instances") i .r1'
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SPELLBOOK_INSTALL_PATH", w "$INSTDIR") i .r1'
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\installationRegistry.ps1"'
  Pop $0
  ${if} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Spellbook could not safely update its installation registration (error $0). No other installation was changed."
    SetErrorLevel 2
    Quit
  ${endIf}
!macroend

!macro customInit
  StrCpy $spellbookRegistrationPrepared "false"
  StrCpy $spellbookInstallCommitted "false"
  ${if} ${Silent}
    !insertmacro runInstallationRegistry "prepare"
    StrCpy $spellbookRegistrationPrepared "true"
  ${endIf}
!macroend

!macro customPageAfterChangeDir
  Page custom SpellbookPrepareSelectedInstall
!macroend

!macro customHeader
  !ifndef BUILD_UNINSTALLER
    Function SpellbookPrepareSelectedInstall
      !insertmacro runInstallationRegistry "prepare"
      StrCpy $spellbookRegistrationPrepared "true"
      Abort
    FunctionEnd

    Function SpellbookRollbackInstallationRegistry
      ${if} $spellbookRegistrationPrepared == "true"
      ${andIf} $spellbookInstallCommitted != "true"
        !insertmacro runInstallationRegistry "rollback"
        StrCpy $spellbookRegistrationPrepared "false"
      ${endIf}
    FunctionEnd

    Function .onInstFailed
      Call SpellbookRollbackInstallationRegistry
    FunctionEnd

    Function .onGUIEnd
      Call SpellbookRollbackInstallationRegistry
    FunctionEnd
  !endif
!macroend

!macro customInstall
  !insertmacro runInstallationRegistry "installed"
  StrCpy $spellbookInstallCommitted "true"
  ${if} ${isNoDesktopShortcut}
    !insertmacro runShortcutOwnership "install" "false" "$DESKTOP\${SHORTCUT_NAME}.lnk" ".spellbook-desktop-shortcut-owner.json"
  ${else}
    !insertmacro runShortcutOwnership "install" "true" "$DESKTOP\${SHORTCUT_NAME}.lnk" ".spellbook-desktop-shortcut-owner.json"
  ${endIf}

  StrCpy $R8 "true"
  ${GetParameters} $R9
  ${GetOptions} $R9 "--no-start-menu-shortcut" $R7
  ${IfNot} ${Errors}
    StrCpy $R8 "false"
  ${EndIf}
  !insertmacro runShortcutOwnership "install" "$R8" "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" ".spellbook-start-menu-shortcut-owner.json"
!macroend

!macro customUnInstall
  !insertmacro runShortcutOwnership "uninstall" "true" "$DESKTOP\${SHORTCUT_NAME}.lnk" ".spellbook-desktop-shortcut-owner.json"
  !insertmacro runShortcutOwnership "uninstall" "true" "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" ".spellbook-start-menu-shortcut-owner.json"
!macroend

!macro customUnInstallSection
  Section "un.-Spellbook installation registration"
    SectionIn RO
    !insertmacro runInstallationRegistry "uninstalled"
  SectionEnd
!macroend
