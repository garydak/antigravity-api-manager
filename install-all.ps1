param(
    [string]$AntigravityDir = '',
    [string]$RuntimeDir = '',
    [string]$ConfigDir = '',
    [string]$Modules = '',
    [switch]$NoUi
)
$ErrorActionPreference = 'Stop'
$nodeBin = (Get-Command node -ErrorAction Stop).Source
if (([version]((& $nodeBin --version).Trim().TrimStart('v'))).Major -lt 22) { throw 'Please install Node.js 22 or later: https://nodejs.org/' }

if (-not $Modules -and -not $NoUi) {
    Add-Type -AssemblyName System.Windows.Forms
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Antigravity API Manager Installer'
    $form.Width = 440
    $form.Height = 280
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false

    $choices = @{}
    $moduleLabels = @(
        'Chinese localization / 界面全量汉化',
        'Account switcher / 多账号秒级热切换',
        'API model switcher / 第三方 API 与中转模型管理'
    )
    $moduleKeys = @('i18n', 'accounts', 'api')

    for ($i = 0; $i -lt $moduleKeys.Length; $i++) {
        $choice = New-Object System.Windows.Forms.CheckBox
        $choice.Text = $moduleLabels[$i]
        $choice.Left = 24
        $choice.Top = 24 + $i * 40
        $choice.Width = 380
        $choice.Checked = $true
        $form.Controls.Add($choice)
        $choices[$moduleKeys[$i]] = $choice
    }

    $button = New-Object System.Windows.Forms.Button
    $button.Text = 'Install'
    $button.Left = 240
    $button.Top = 180
    $button.Width = 150
    $button.Height = 36
    $button.DialogResult = 'OK'
    $form.Controls.Add($button)
    $form.AcceptButton = $button

    if ($form.ShowDialog() -ne 'OK') { exit 0 }
    $Modules = (($moduleKeys | Where-Object { $choices[$_].Checked }) -join ',')
    if (-not $Modules) { throw 'Please select at least one module.' }
}

if (-not $Modules) { $Modules = 'i18n,accounts,api' }
$installArgs = @((Join-Path $PSScriptRoot 'suite\install.cjs'), '--modules', $Modules, '--guardian', 'false')
if ($AntigravityDir) { $installArgs += @('--app', $AntigravityDir) }
if ($RuntimeDir) { $installArgs += @('--runtime', $RuntimeDir) }
if ($ConfigDir) { $installArgs += @('--config', $ConfigDir) }

& $nodeBin @installArgs
if ($LASTEXITCODE -ne 0) { throw 'Installation failed.' }