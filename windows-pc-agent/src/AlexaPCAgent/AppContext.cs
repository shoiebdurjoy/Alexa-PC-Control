using System;
using System.Drawing;
using System.Windows.Forms;
using AlexaPCAgent.Commands;
using AlexaPCAgent.Services;

namespace AlexaPCAgent
{
    public class AppContext : ApplicationContext
    {
        private readonly NotifyIcon _notifyIcon;
        private readonly WebSocketClientService _wsClient;
        private readonly CommandRegistry _commandRegistry;
        private readonly InternalSchedulerService _scheduler;
        private readonly StatusMonitorService _statusMonitor;
        private readonly ToolStripMenuItem _statusMenuItem;
        private readonly ToolStripMenuItem _autoStartMenuItem;

        public AppContext(string backendUrl, string agentToken)
        {
            _scheduler = new InternalSchedulerService();
            _statusMonitor = new StatusMonitorService(_scheduler);
            _commandRegistry = new CommandRegistry();

            RegisterCommands();

            _wsClient = new WebSocketClientService(backendUrl, agentToken, _commandRegistry);
            _wsClient.OnConnectionStatusChanged += UpdateConnectionStatus;

            _statusMenuItem = new ToolStripMenuItem("Status: Connecting...", null, OnStatusClick);
            _autoStartMenuItem = new ToolStripMenuItem("Start with Windows", null, OnAutoStartClick)
            {
                Checked = AutoStartManager.IsAutoStartEnabled()
            };

            var contextMenu = new ContextMenuStrip();
            contextMenu.Items.Add(_statusMenuItem);
            contextMenu.Items.Add(new ToolStripMenuItem("Manual Reconnect", null, (s, e) => _wsClient.Start()));
            contextMenu.Items.Add(_autoStartMenuItem);
            contextMenu.Items.Add(new ToolStripSeparator());
            contextMenu.Items.Add(new ToolStripMenuItem("Exit", null, OnExitClick));

            _notifyIcon = new NotifyIcon
            {
                Icon = SystemIcons.Shield,
                ContextMenuStrip = contextMenu,
                Text = "Alexa PC Control Agent",
                Visible = true
            };

            _wsClient.Start();
        }

        private void RegisterCommands()
        {
            _commandRegistry.Register(new LockCommand());
            _commandRegistry.Register(new ShutdownCommand(_scheduler));
            _commandRegistry.Register(new SleepCommand(_scheduler));
            _commandRegistry.Register(new RestartCommand(_scheduler));
            _commandRegistry.Register(new CancelScheduleCommand(_scheduler));
            _commandRegistry.Register(new MuteCommand());
            _commandRegistry.Register(new UnmuteCommand());
            _commandRegistry.Register(new VolumeUpCommand());
            _commandRegistry.Register(new VolumeDownCommand());
            _commandRegistry.Register(new SetVolumeCommand());
            _commandRegistry.Register(new MediaPlayCommand());
            _commandRegistry.Register(new MediaPauseCommand());
            _commandRegistry.Register(new MediaNextCommand());
            _commandRegistry.Register(new MediaPrevCommand());
            _commandRegistry.Register(new StatusCommand(_statusMonitor));
        }

        private void UpdateConnectionStatus(bool connected)
        {
            if (_statusMenuItem.Owner != null && _statusMenuItem.Owner.InvokeRequired)
            {
                _statusMenuItem.Owner.Invoke(() => UpdateConnectionStatus(connected));
                return;
            }

            if (connected)
            {
                _statusMenuItem.Text = "Status: Online (Connected)";
                _notifyIcon.Text = "Alexa PC Control Agent - Connected";
            }
            else
            {
                _statusMenuItem.Text = "Status: Offline (Reconnecting...)";
                _notifyIcon.Text = "Alexa PC Control Agent - Offline";
            }
        }

        private void OnStatusClick(object? sender, EventArgs e)
        {
            MessageBox.Show(
                $"Agent Connection: {(_wsClient.IsConnected ? "Online" : "Offline")}\n" +
                $"Machine: {Environment.MachineName}\n" +
                $"Active Timers: {_scheduler.GetActiveScheduleCount()}",
                "Alexa PC Control Agent Status",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );
        }

        private void OnAutoStartClick(object? sender, EventArgs e)
        {
            bool newState = !_autoStartMenuItem.Checked;
            if (AutoStartManager.SetAutoStart(newState))
            {
                _autoStartMenuItem.Checked = newState;
            }
            else
            {
                MessageBox.Show("Failed to update Windows Registry for auto-start.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void OnExitClick(object? sender, EventArgs e)
        {
            _wsClient.Dispose();
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
            Application.Exit();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _wsClient.Dispose();
                _notifyIcon.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
