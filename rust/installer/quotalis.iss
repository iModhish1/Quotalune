#define MyAppName "Quotalis"
#ifndef AppVersion
  #define AppVersion "0.0.0-dev"
#endif
#ifndef TargetBinDir
  #define TargetBinDir "..\\..\\target\\release"
#endif
#ifndef OutputDir
  #define OutputDir "..\\target\\installer"
#endif
#ifndef OutputBaseFilename
  #define OutputBaseFilename "Quotalis-" + AppVersion + "-x64-Setup"
#endif
#ifndef VCRedistPath
  #define VCRedistPath "..\\target\\installer-deps\\vc_redist.x64.exe"
#endif
#ifndef WebView2BootstrapperPath
  #define WebView2BootstrapperPath "..\\target\\installer-deps\\MicrosoftEdgeWebview2Setup.exe"
#endif

[Setup]
; LEGACY_SECURITY_COMPATIBILITY: AppId is Inno's own upgrade-continuity
; identity, a separate namespace from the Tauri bundle identifier
; (app.quotaarc.desktop). Preserved unchanged per
; docs/validation/QUOTALIS_WINDOWS_IDENTITY_MIGRATION.md's Option A --
; renaming it would be a cosmetic change with real upgrade-continuity risk
; if this installer is ever run against a machine that used it before.
AppId=QuotaArcDesktop
AppName={#MyAppName}
AppVersion={#AppVersion}
AppVerName={#MyAppName} {#AppVersion}
AppPublisher=Quotalis
AppPublisherURL=https://github.com/iModhish1/Quotalis
AppSupportURL=https://github.com/iModhish1/Quotalis/issues
AppUpdatesURL=https://github.com/iModhish1/Quotalis/releases
DefaultDirName={localappdata}\Programs\Quotalis
DefaultGroupName=Quotalis
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
UsePreviousAppDir=yes
CloseApplications=yes
WizardStyle=modern
Compression=lzma
SolidCompression=yes
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
SetupIconFile=..\icons\icon.ico
UninstallDisplayIcon={app}\Quotalis.exe
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Files]
Source: "{#TargetBinDir}\Quotalis.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#TargetBinDir}\quotalis-cli.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#TargetBinDir}\quotalis-desktop.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\icons\icon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\assets\brand\icons\quotaarc-icon-128.png"; DestDir: "{app}"; DestName: "quotalis-icon-128.png"; Flags: ignoreversion
Source: "..\..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\NOTICE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\THIRD_PARTY_NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#VCRedistPath}"; Flags: dontcopy
Source: "{#WebView2BootstrapperPath}"; Flags: dontcopy

[Icons]
; AppUserModelID must match the identity the running app registers itself
; (app.quotaarc.desktop -- see the [Registry] section below and
; docs/validation/QUOTALIS_WINDOWS_IDENTITY_MIGRATION.md's Option A).
; Without it, Inno lets Windows synthesize its own AppID from the
; shortcut's target+arguments, which does NOT match the app's real
; identity -- verified via `Get-StartApps` against a real install: the
; shortcut resolved to an auto-generated GUID-based AppID instead of
; app.quotaarc.desktop, breaking the "Start Menu pin survives
; automatically" guarantee Option A depends on, even though the app
; itself was registering the correct AUMID at runtime the whole time.
Name: "{autoprograms}\Quotalis"; Filename: "{app}\Quotalis.exe"; Parameters: "menubar"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"; AppUserModelID: "app.quotaarc.desktop"
Name: "{autodesktop}\Quotalis"; Filename: "{app}\Quotalis.exe"; Parameters: "menubar"; WorkingDir: "{app}"; Tasks: desktopicon; IconFilename: "{app}\icon.ico"; AppUserModelID: "app.quotaarc.desktop"

[Registry]
; Give this installer the same stable Windows notification identity as the
; Tauri package. This prevents Windows from substituting the generic app
; glyph. app.quotaarc.desktop preserved unchanged (Option A); the
; DisplayName shown in Windows notification settings is the current brand.
Root: HKCU; Subkey: "Software\Classes\AppUserModelId\app.quotaarc.desktop"; ValueType: string; ValueName: "DisplayName"; ValueData: "Quotalis"; Flags: uninsdeletekey
; Toast identity uses the packaged raster artwork, separate from shortcut ICOs.
Root: HKCU; Subkey: "Software\Classes\AppUserModelId\app.quotaarc.desktop"; ValueType: string; ValueName: "IconUri"; ValueData: "{app}\quotalis-icon-128.png"
Root: HKCU; Subkey: "Software\Classes\AppUserModelId\app.quotaarc.desktop"; ValueType: string; ValueName: "IconBackgroundColor"; ValueData: "FF10141C"

[Run]
; Interactive installs: optional checkbox on the finish page.
Filename: "{app}\Quotalis.exe"; Parameters: "menubar"; Description: "Launch Quotalis"; Flags: nowait postinstall skipifsilent; Check: CanLaunchQuotalis
; Silent upgrades (winget / in-app updater): always relaunch so the tray icon
; returns after CloseApplications kills the previous process. Single-instance
; handles a second launch from the updater helper if both fire.
Filename: "{app}\Quotalis.exe"; Parameters: "menubar"; Flags: nowait postinstall skipifnotsilent; Check: CanLaunchQuotalis

[Code]
var
  NeedsVCRedistRestart: Boolean;
  NeedsWebView2Restart: Boolean;

function WebView2InstalledInView(RootKey: Integer): Boolean;
var
  RuntimeVersion: String;
begin
  Result :=
    RegQueryStringValue(
      RootKey,
      'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
      'pv',
      RuntimeVersion
    ) and
    (RuntimeVersion <> '');
end;

function WebView2NeedsInstall(): Boolean;
begin
  Result :=
    not WebView2InstalledInView(HKLM64) and
    not WebView2InstalledInView(HKLM32) and
    not WebView2InstalledInView(HKCU);
end;

procedure EnsureWebView2Installed();
var
  ResultCode: Integer;
begin
  if not WebView2NeedsInstall() then
    exit;

  ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');

  WizardForm.StatusLabel.Caption := 'Installing Microsoft Edge WebView2 Runtime...';
  WizardForm.ProgressGauge.Style := npbstMarquee;
  try
    if not Exec(
      ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'),
      '/silent /install',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode
    ) then
      RaiseException('Failed to start the Microsoft Edge WebView2 Runtime installer.');

    if (ResultCode <> 0) and (ResultCode <> 1638) and (ResultCode <> 3010) then
      RaiseException(
        'Microsoft Edge WebView2 Runtime installation failed with exit code ' +
        IntToStr(ResultCode) +
        '.'
      );

    if ResultCode = 3010 then
      NeedsWebView2Restart := True;
  finally
    WizardForm.ProgressGauge.Style := npbstNormal;
  end;
end;

function VCRedistInstalledInView(RootKey: Integer): Boolean;
var
  Installed: Cardinal;
begin
  Result :=
    RegQueryDWordValue(
      RootKey,
      'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
      'Installed',
      Installed
    ) and
    (Installed = 1);
end;

function VCRedistNeedsInstall(): Boolean;
begin
  Result :=
    not VCRedistInstalledInView(HKLM64) and
    not VCRedistInstalledInView(HKLM32);
end;

procedure EnsureVCRedistInstalled();
var
  ResultCode: Integer;
begin
  if not VCRedistNeedsInstall() then
    exit;

  ExtractTemporaryFile('vc_redist.x64.exe');

  WizardForm.StatusLabel.Caption := 'Installing Microsoft Visual C++ Runtime...';
  WizardForm.ProgressGauge.Style := npbstMarquee;
  try
    if not Exec(
      ExpandConstant('{tmp}\vc_redist.x64.exe'),
      '/install /quiet /norestart',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode
    ) then
      RaiseException('Failed to start the Microsoft Visual C++ Runtime installer.');

    if (ResultCode <> 0) and (ResultCode <> 1638) and (ResultCode <> 3010) then
      RaiseException(
        'Microsoft Visual C++ Runtime installation failed with exit code ' +
        IntToStr(ResultCode) +
        '.'
      );

    if ResultCode = 3010 then
      NeedsVCRedistRestart := True;
  finally
    WizardForm.ProgressGauge.Style := npbstNormal;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then begin
    EnsureWebView2Installed();
    EnsureVCRedistInstalled();
  end;
end;

function NeedRestart(): Boolean;
begin
  Result := NeedsVCRedistRestart or NeedsWebView2Restart;
end;

function CanLaunchQuotalis(): Boolean;
begin
  Result := not NeedsVCRedistRestart and not NeedsWebView2Restart;
end;
