# Voice Commands Reference

**Invocation Name**: `my computer`

All commands are triggered by addressing Alexa with the invocation phrase.

---

## 1. System Power & Session Commands

| Action | Alexa Utterance Examples | Internal Command ID | Parameters |
| :--- | :--- | :--- | :--- |
| **Lock PC** | *"Alexa, ask my computer to lock the PC"*<br>*"Alexa, ask my computer to lock the computer"* | `LOCK` | None |
| **Sleep PC** | *"Alexa, ask my computer to put the PC to sleep"*<br>*"Alexa, ask my computer to sleep"* | `SLEEP` | None |
| **Sleep PC (Scheduled)** | *"Alexa, ask my computer to put the PC to sleep in twenty minutes"* | `SLEEP` | `durationMinutes`: 20 |
| **Restart PC** | *"Alexa, ask my computer to restart the PC"* | `RESTART` | None |
| **Restart PC (Scheduled)** | *"Alexa, ask my computer to restart the PC in ten minutes"* | `RESTART` | `durationMinutes`: 10 |
| **Shutdown PC** | *"Alexa, ask my computer to shut down the PC"* | `SHUTDOWN` | None |
| **Shutdown PC (Scheduled)**| *"Alexa, ask my computer to shut down the PC in thirty minutes"* | `SHUTDOWN` | `durationMinutes`: 30 |
| **Cancel Schedule** | *"Alexa, ask my computer to cancel shutdown"*<br>*"Alexa, ask my computer to cancel sleep"*<br>*"Alexa, ask my computer to cancel restart"* | `CANCEL_SCHEDULE` | None |

---

## 2. Audio Control Commands

| Action | Alexa Utterance Examples | Internal Command ID | Parameters |
| :--- | :--- | :--- | :--- |
| **Mute Audio** | *"Alexa, ask my computer to mute the PC"*<br>*"Alexa, ask my computer to mute"* | `MUTE` | None |
| **Unmute Audio** | *"Alexa, ask my computer to unmute the PC"* | `UNMUTE` | None |
| **Volume Up** | *"Alexa, ask my computer to increase volume"*<br>*"Alexa, ask my computer to turn up volume"* | `VOLUME_UP` | None |
| **Volume Down** | *"Alexa, ask my computer to decrease volume"*<br>*"Alexa, ask my computer to turn down volume"* | `VOLUME_DOWN` | None |
| **Set Volume (%)** | *"Alexa, ask my computer to set volume to fifty percent"*<br>*"Alexa, ask my computer to set volume to eighty"* | `SET_VOLUME` | `volumePercent`: 0 to 100 |

---

## 3. Telemetry & PC Status

| Action | Alexa Utterance Examples | Internal Command ID | Alexa Response Example |
| :--- | :--- | :--- | :--- |
| **PC Status** | *"Alexa, ask my computer for status"*<br>*"Alexa, ask my computer how is the PC"* | `GET_STATUS` | *"PC is online. Volume is set to 50 percent, unmuted. Shutdown scheduled in 15 minutes."* |
