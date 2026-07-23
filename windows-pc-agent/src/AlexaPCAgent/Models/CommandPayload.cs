using System.Text.Json.Serialization;

namespace AlexaPCAgent.Models
{
    public class CommandPayload
    {
        [JsonPropertyName("version")]
        public string Version { get; set; } = "1.0";

        [JsonPropertyName("command")]
        public string Command { get; set; } = string.Empty;

        [JsonPropertyName("params")]
        public CommandParams? Params { get; set; }

        [JsonPropertyName("timestamp")]
        public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    public class CommandParams
    {
        [JsonPropertyName("durationMinutes")]
        public int? DurationMinutes { get; set; }

        [JsonPropertyName("volumePercent")]
        public int? VolumePercent { get; set; }
    }

    public class CommandResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public object? Data { get; set; }

        public static CommandResult Ok(string message, object? data = null) =>
            new CommandResult { Success = true, Message = message, Data = data };

        public static CommandResult Fail(string message) =>
            new CommandResult { Success = false, Message = message };
    }
}
