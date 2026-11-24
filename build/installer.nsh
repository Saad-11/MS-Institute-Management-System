; ============================================================================
; MS Institute Management System — Custom NSIS Installer & Uninstaller Hooks
; ============================================================================
; Provides two safe uninstallation options without touching external backups
; or unrelated user directories:
;   1. Uninstall Software Only — Keep Database (Default & Recommended)
;   2. Uninstall Software and Delete All Application Data (Requires explicit
;      confirmation via "WARNING: PERMANENT DATA DELETION" screen)
;
; 100% offline — uses only native NSIS + Win32 controls bundled with Windows.
; ============================================================================

!ifndef BUILD_UNINSTALLER
  ; No custom hooks needed for installation phase.
!else

  ; ─── Uninstaller State Variables ──────────────────────────────────────────
  Var DeleteAllAppData
  Var ConfirmedPermanentDelete
  Var DeleteFailedPath

  ; Page 1 Controls (Uninstallation Options)
  Var UnOptDialog
  Var UnOptRadioKeep
  Var UnOptRadioDelete
  Var UnOptBoldFont

  ; Page 2 Controls (Permanent Data Deletion Confirmation)
  Var ConfirmDialog
  Var ConfirmWarningFont
  Var ConfirmTitleLabel
  Var ConfirmIconCtrl
  Var ConfirmIconHandle
  Var ConfirmBtnCancel
  Var ConfirmBtnDelete
  Var WizardNextBtn
  Var WizardCancelBtn
  Var WizardBackBtn

  ; ─── Initialize Safe Defaults ─────────────────────────────────────────────
  !macro customUnInit
    StrCpy $DeleteAllAppData "0"
    StrCpy $ConfirmedPermanentDelete "0"
    StrCpy $DeleteFailedPath ""
  !macroend

  ; ─── Insert Custom Uninstall Functions & Pages After MUI2 Is Loaded ──────
  !macro customUnWelcomePage
    !include "nsDialogs.nsh"
    !include "LogicLib.nsh"
    !include "WinMessages.nsh"

    ; Win32 constants
    !ifndef BM_SETCHECK
      !define BM_SETCHECK 0x00F1
    !endif
    !ifndef BM_GETCHECK
      !define BM_GETCHECK 0x00F0
    !endif
    !ifndef BM_CLICK
      !define BM_CLICK 0x00F5
    !endif
    !ifndef BST_CHECKED
      !define BST_CHECKED 0x0001
    !endif
    !ifndef BST_UNCHECKED
      !define BST_UNCHECKED 0x0000
    !endif
    !ifndef WM_SETFONT
      !define WM_SETFONT 0x0030
    !endif
    !ifndef STM_SETIMAGE
      !define STM_SETIMAGE 0x0172
    !endif
    !ifndef IMAGE_ICON
      !define IMAGE_ICON 1
    !endif
    !ifndef LR_SHARED
      !define LR_SHARED 0x8000
    !endif

    !insertmacro MUI_UNPAGE_WELCOME

    ; ─── Helper: Ensure Wizard Navigation Buttons Are Visible & Enabled ────
    Function un.RestoreWizardButtons
      GetDlgItem $WizardNextBtn $HWNDPARENT 1
      GetDlgItem $WizardCancelBtn $HWNDPARENT 2
      GetDlgItem $WizardBackBtn $HWNDPARENT 3
      ShowWindow $WizardNextBtn ${SW_SHOW}
      EnableWindow $WizardNextBtn 1
      ShowWindow $WizardCancelBtn ${SW_SHOW}
      EnableWindow $WizardCancelBtn 1
      ShowWindow $WizardBackBtn ${SW_SHOW}
      EnableWindow $WizardBackBtn 1
    FunctionEnd

    ; ─── Page 1: Two Uninstallation Options ────────────────────────────────
    Function un.UninstallOptionsPageCreate
      Call un.RestoreWizardButtons
      StrCpy $ConfirmedPermanentDelete "0"

      !insertmacro MUI_HEADER_TEXT "Uninstallation Options" "Choose whether to keep or permanently delete your application data and database."

      nsDialogs::Create 1018
      Pop $UnOptDialog
      ${If} "$UnOptDialog" == "error"
        Abort
      ${EndIf}

      CreateFont $UnOptBoldFont "$(^Font)" "$(^FontSize)" "700"

      ${NSD_CreateLabel} 0u 0u 300u 12u "Select how you want to uninstall ${PRODUCT_NAME}:"
      Pop $0

      ; Option 1: Keep Database (Default safe option)
      ${NSD_CreateRadioButton} 0u 16u 300u 14u "Uninstall Software Only — Keep Database"
      Pop $UnOptRadioKeep
      SendMessage $UnOptRadioKeep ${WM_SETFONT} $UnOptBoldFont 0

      ${NSD_CreateLabel} 14u 31u 284u 26u "Remove ${PRODUCT_NAME} from this computer, but keep all application data and records. If you reinstall the software later, your previous records should remain available."
      Pop $0

      ; Option 2: Delete All Application Data
      ${NSD_CreateRadioButton} 0u 62u 300u 14u "Uninstall Software and Delete All Application Data"
      Pop $UnOptRadioDelete
      SendMessage $UnOptRadioDelete ${WM_SETFONT} $UnOptBoldFont 0

      ${NSD_CreateLabel} 14u 77u 284u 26u "Completely remove ${PRODUCT_NAME}, including its database, student records, teacher records, financial records, settings, and other application data. This action cannot be undone."
      Pop $0

      ; External Backup Protection Note
      ${NSD_CreateLabel} 0u 112u 300u 22u "Note: Backup files (.smbak) saved outside the application data directory (such as USB drives, Desktop, or Documents) will never be deleted."
      Pop $0

      ; Restore previous selection, defaulting strictly to Option 1 (Keep Database)
      ${If} "$DeleteAllAppData" == "1"
        SendMessage $UnOptRadioKeep ${BM_SETCHECK} ${BST_UNCHECKED} 0
        SendMessage $UnOptRadioDelete ${BM_SETCHECK} ${BST_CHECKED} 0
      ${Else}
        SendMessage $UnOptRadioDelete ${BM_SETCHECK} ${BST_UNCHECKED} 0
        SendMessage $UnOptRadioKeep ${BM_SETCHECK} ${BST_CHECKED} 0
      ${EndIf}

      nsDialogs::Show
    FunctionEnd

    Function un.UninstallOptionsPageLeave
      ${NSD_GetState} $UnOptRadioDelete $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $DeleteAllAppData "1"
        StrCpy $ConfirmedPermanentDelete "0"
      ${Else}
        StrCpy $DeleteAllAppData "0"
        StrCpy $ConfirmedPermanentDelete "0"
      ${EndIf}
    FunctionEnd

    ; ─── Page 2: Strong Confirmation Dialog for Option 2 ────────────────────
    Function un.ConfirmDeletePageCreate
      ; Skip completely when Option 1 (Keep Database) is selected
      ${If} "$DeleteAllAppData" != "1"
        StrCpy $ConfirmedPermanentDelete "0"
        Abort
      ${EndIf}

      StrCpy $ConfirmedPermanentDelete "0"
      !insertmacro MUI_HEADER_TEXT "WARNING: PERMANENT DATA DELETION" "Confirm permanent deletion of all ${PRODUCT_NAME} records and files."

      nsDialogs::Create 1018
      Pop $ConfirmDialog
      ${If} "$ConfirmDialog" == "error"
        StrCpy $DeleteAllAppData "0"
        Abort
      ${EndIf}

      ; Hide standard Next and Cancel footer buttons on this confirmation dialog so the user
      ; interacts explicitly with the two unambiguous confirmation buttons below (plus < Back).
      GetDlgItem $WizardNextBtn $HWNDPARENT 1
      GetDlgItem $WizardCancelBtn $HWNDPARENT 2
      GetDlgItem $WizardBackBtn $HWNDPARENT 3
      ShowWindow $WizardNextBtn ${SW_HIDE}
      EnableWindow $WizardNextBtn 0
      ShowWindow $WizardCancelBtn ${SW_HIDE}

      ; Warning Icon (Win32 IDI_WARNING = 32515)
      ${NSD_CreateIcon} 0u 2u 24u 24u ""
      Pop $ConfirmIconCtrl
      System::Call 'user32::LoadImage(p 0, i 32515, i ${IMAGE_ICON}, i 32, i 32, i ${LR_SHARED}) p .r0'
      StrCpy $ConfirmIconHandle $0
      SendMessage $ConfirmIconCtrl ${STM_SETIMAGE} ${IMAGE_ICON} $ConfirmIconHandle

      ; Bold Red Warning Title (NSIS SetCtlColors expects RRGGBB hex without 0x prefix)
      CreateFont $ConfirmWarningFont "$(^Font)" "10" "700"
      ${NSD_CreateLabel} 28u 6u 270u 16u "WARNING: PERMANENT DATA DELETION"
      Pop $ConfirmTitleLabel
      SendMessage $ConfirmTitleLabel ${WM_SETFONT} $ConfirmWarningFont 0
      SetCtlColors $ConfirmTitleLabel "B91C1C" "transparent"

      ; Exact Required Warning Text
      ${NSD_CreateLabel} 0u 30u 300u 38u "Are you sure you want to permanently delete all ${PRODUCT_NAME} data from this computer? This includes student records, teacher records, fees, examination results, attendance, settings, and locally stored files."
      Pop $0

      ; Scoped Protection Reassurance
      ${NSD_CreateLabel} 0u 72u 300u 26u "Only application-owned database and data folders will be removed. Your Documents, Desktop, USB backups (.smbak), and unrelated files remain completely safe."
      Pop $0

      ; Action Buttons: Cancel (Default/Safe) and Permanently Delete All Application Data
      ${NSD_CreateButton} 0u 108u 72u 18u "Cancel"
      Pop $ConfirmBtnCancel
      ${NSD_OnClick} $ConfirmBtnCancel un.OnCancelPermanentDelete

      ${NSD_CreateButton} 82u 108u 216u 18u "Permanently Delete All Application Data"
      Pop $ConfirmBtnDelete
      ${NSD_OnClick} $ConfirmBtnDelete un.OnConfirmPermanentDelete

      ; Focus Cancel by default so accidental Enter key never triggers permanent deletion
      ${NSD_SetFocus} $ConfirmBtnCancel

      nsDialogs::Show
    FunctionEnd

    Function un.OnCancelPermanentDelete
      ; Reset both delete flags safely and return to Options screen (Option 1 selected)
      StrCpy $DeleteAllAppData "0"
      StrCpy $ConfirmedPermanentDelete "0"
      Call un.RestoreWizardButtons
      SendMessage $WizardBackBtn ${BM_CLICK} 0 0
    FunctionEnd

    Function un.OnConfirmPermanentDelete
      ; Only explicit click on this button authorizes permanent data deletion
      StrCpy $ConfirmedPermanentDelete "1"
      Call un.RestoreWizardButtons
      SendMessage $WizardNextBtn ${BM_CLICK} 0 0
    FunctionEnd

    Function un.ConfirmDeletePageLeave
      ${If} "$DeleteAllAppData" == "1"
      ${AndIf} "$ConfirmedPermanentDelete" != "1"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Please click 'Permanently Delete All Application Data' to confirm, or click 'Cancel' / 'Back' to keep your database."
        Abort
      ${EndIf}
    FunctionEnd

    ; ─── Scoped, Safety-Verified App Data Deletion Routine ───────────────────
    Function un.SafeDeleteAppDir
      Exch $0 ; $0 = target directory path
      Push $1
      Push $2

      ${If} "$0" == ""
        Goto msims_safedel_done
      ${EndIf}
      ${IfNot} ${FileExists} "$0\*.*"
        Goto msims_safedel_done
      ${EndIf}

      ; Absolute safety guard: refuse broad user folders under all circumstances
      ${If} "$0" == "$APPDATA"
      ${OrIf} "$0" == "$LOCALAPPDATA"
      ${OrIf} "$0" == "$PROFILE"
      ${OrIf} "$0" == "$DOCUMENTS"
      ${OrIf} "$0" == "$DESKTOP"
        DetailPrint "Safety guard blocked unexpected folder target: $0"
        StrCpy $DeleteFailedPath "$DeleteFailedPath$\r$\n- Blocked unsafe path: $0"
        Goto msims_safedel_done
      ${EndIf}

      DetailPrint "Removing application data directory: $0"

      ; Explicitly handle SQLite WAL, SHM, and main database file first with retry checks
      ${If} ${FileExists} "$0\school_data.sqlite-wal"
      ${OrIf} ${FileExists} "$0\school_data.sqlite-shm"
      ${OrIf} ${FileExists} "$0\school_data.sqlite"
        StrCpy $1 0
        msims_retry_db_remove:
          IntOp $1 $1 + 1
          ClearErrors
          Delete "$0\school_data.sqlite-wal"
          Delete "$0\school_data.sqlite-shm"
          Delete "$0\school_data.sqlite"

          ${If} ${FileExists} "$0\school_data.sqlite"
          ${OrIf} ${FileExists} "$0\school_data.sqlite-wal"
          ${OrIf} ${FileExists} "$0\school_data.sqlite-shm"
            ${If} $1 < 3
              Sleep 800
              Goto msims_retry_db_remove
            ${Else}
              StrCpy $DeleteFailedPath "$DeleteFailedPath$\r$\n- $0\school_data.sqlite (database file is locked or in use)"
              Goto msims_safedel_done
            ${EndIf}
          ${EndIf}
      ${EndIf}

      ; Remove remaining application-owned files (uploads, internal backups, Electron storage)
      ClearErrors
      RMDir /r "$0"
      ${If} ${FileExists} "$0\*.*"
        Sleep 800
        ClearErrors
        RMDir /r "$0"
        ${If} ${FileExists} "$0\*.*"
          StrCpy $DeleteFailedPath "$DeleteFailedPath$\r$\n- $0 (some application files remain locked)"
        ${EndIf}
      ${EndIf}

      msims_safedel_done:
      Pop $2
      Pop $1
      Pop $0
    FunctionEnd

    UninstPage custom un.UninstallOptionsPageCreate un.UninstallOptionsPageLeave
    UninstPage custom un.ConfirmDeletePageCreate un.ConfirmDeletePageLeave
  !macroend

  ; ─── Execute Scoped Data Deletion After Software Uninstall ─────────────────
  !macro customUnInstall
    ; Execute permanent data deletion ONLY when:
    ;   1. Running interactively (NEVER during silent upgrades or /S installs)
    ;   2. Option 2 was explicitly selected ($DeleteAllAppData == "1")
    ;   3. Explicit confirmation button was clicked ($ConfirmedPermanentDelete == "1")
    ${IfNot} ${Silent}
    ${AndIf} "$DeleteAllAppData" == "1"
    ${AndIf} "$ConfirmedPermanentDelete" == "1"
      DetailPrint "Deleting ${PRODUCT_NAME} database, uploads, and configuration data..."

      ; Switch to current user context so $APPDATA resolves to the interactive user AppData
      ${If} "$installMode" == "all"
        SetShellVarContext current
      ${EndIf}

      ; Double-check application executable is no longer holding SQLite file locks
      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${If} $R0 == 0
        Sleep 1000
        !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
        ${If} $R0 == 0
          DetailPrint "Application process still active; skipping locked database deletion."
          StrCpy $DeleteFailedPath "$DeleteFailedPath$\r$\n- ${APP_EXECUTABLE_FILENAME} is still running and locking database files."
          Goto msims_restore_context_and_report
        ${EndIf}
      ${EndIf}

      ; Small delay so Windows releases any closing handles cleanly
      Sleep 300

      StrCpy $DeleteFailedPath ""

      ; Verify $APPDATA is non-empty before removing application-specific folders
      ${If} "$APPDATA" != ""
        ; 1. Active packaged AppData folder: %APPDATA%\MS Institute Management System
        Push "$APPDATA\${PRODUCT_FILENAME}"
        Call un.SafeDeleteAppDir

        ; 2. Legacy package-name AppData folder checked by ensureUserDataMigrated()
        Push "$APPDATA\school-management-system"
        Call un.SafeDeleteAppDir

        ; 3. Legacy display-name candidate checked by ensureUserDataMigrated()
        ${If} "${PRODUCT_FILENAME}" != "School Management System"
          Push "$APPDATA\School Management System"
          Call un.SafeDeleteAppDir
        ${EndIf}
      ${EndIf}

      ; 4. Application updater cache in %LOCALAPPDATA% (only if present)
      ${If} "$LOCALAPPDATA" != ""
        Push "$LOCALAPPDATA\school-management-system-updater"
        Call un.SafeDeleteAppDir
      ${EndIf}

      msims_restore_context_and_report:
      ${If} "$installMode" == "all"
        SetShellVarContext all
      ${EndIf}

      ; Report honestly if any file/folder could not be removed instead of claiming silent success
      ${If} "$DeleteFailedPath" != ""
        MessageBox MB_OK|MB_ICONSTOP "Warning: ${PRODUCT_NAME} program files were uninstalled, but some application data could not be removed because the files are locked or inaccessible:$\r$\n$DeleteFailedPath$\r$\n$\r$\nPlease close any program using those files and remove the listed folder(s) manually."
        SetErrors
      ${Else}
        DetailPrint "All ${PRODUCT_NAME} application data and SQLite database files removed successfully."
      ${EndIf}
    ${Else}
      DetailPrint "Keeping existing ${PRODUCT_NAME} database and user data intact."
    ${EndIf}
  !macroend

!endif
