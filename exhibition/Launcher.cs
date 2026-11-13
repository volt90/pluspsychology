using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyCompany("PlusPsychology")]
[assembly: AssemblyProduct("김심리월드 전시 운영")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]
#if EXHIBITION_STOP
[assembly: AssemblyTitle("전시 종료")]
#else
[assembly: AssemblyTitle("전시 시작")]
#endif

internal static class Launcher
{
    internal const string SiteUrl = "https://www.pluspsychology.ai/experience/mind-forest";
    private const string WindowTitle = "김심리월드 전시 운영";
    private const string MutexName = @"Local\PlusPsychology.MindForestExhibition.Launcher";
    private static string ProfilePath
    {
        get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PlusPsychology", "MindForestExhibition", "ChromeProfile"); }
    }

    private sealed class BrowserInstance
    {
        public int Id;
        public long StartTicks;
        public string Executable;
    }

    [DllImport("shell32.dll", SetLastError = true)]
    private static extern IntPtr CommandLineToArgvW([MarshalAs(UnmanagedType.LPWStr)] string commandLine, out int count);
    [DllImport("kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr pointer);
    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr window, int command);

    [STAThread]
    private static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        try
        {
            if (args.Length > 0)
            {
                if (args[0] == "--self-test") return Report(SelfTest(), args);
                if (args[0] == "--diagnose") return Report(Diagnose(args.Contains("--check-network")), args);
                return Report(new { ok = false, error = "Use --diagnose [--check-network] [--output path] or --self-test [--output path]." }, args, 2);
            }
            using (var gate = new Mutex(false, MutexName))
            {
                bool acquired;
                try { acquired = gate.WaitOne(10000); }
                catch (AbandonedMutexException) { acquired = true; }
                if (!acquired) return 0;
                try
                {
#if EXHIBITION_STOP
                    StopExhibition();
#else
                    StartExhibition();
#endif
                }
                finally { gate.ReleaseMutex(); }
            }
            return 0;
        }
        catch (Exception error)
        {
            if (args.Length > 0) return Report(new { ok = false, error = error.Message }, args, 1);
            MessageBox.Show(error.Message, WindowTitle, MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 1;
        }
    }

    private static int Report(object value, string[] args, int exitCode = 0)
    {
        string json = new JavaScriptSerializer().Serialize(value);
        int output = Array.IndexOf(args, "--output");
        if (output >= 0 && output + 1 < args.Length)
            File.WriteAllText(Path.GetFullPath(args[output + 1]), json, new System.Text.UTF8Encoding(false));
        else Console.WriteLine(json);
        return exitCode;
    }

    private static object Diagnose(bool checkNetwork)
    {
        string chrome = FindChrome();
        var instances = FindExhibitionBrowsers();
        string networkError = checkNetwork ? CheckWebsite() : null;
        return new
        {
            ok = chrome != null && networkError == null,
            action = "diagnose_only_no_browser_started_or_closed",
            url = SiteUrl,
            chrome = chrome,
            chromeInstalled = chrome != null,
            chromeVersion = chrome == null ? null : FileVersionInfo.GetVersionInfo(chrome).FileVersion,
            profile = ProfilePath,
            profileExists = Directory.Exists(ProfilePath),
            exhibitionProcessIds = instances.Select(item => item.Id).ToArray(),
            networkChecked = checkNetwork,
            networkError = networkError,
            operatingSystem = Environment.OSVersion.ToString(),
            framework = Environment.Version.ToString(),
            administratorRequired = false
        };
    }

    private static void StartExhibition()
    {
        var existing = FindExhibitionBrowsers();
        if (existing.Count > 0)
        {
            foreach (var instance in existing)
            {
                using (Process process = GetVerifiedProcess(instance))
                {
                    if (process == null) continue;
                    IntPtr handle = process.MainWindowHandle;
                    if (handle != IntPtr.Zero) { ShowWindow(handle, 9); SetForegroundWindow(handle); }
                }
            }
            return;
        }
        string chrome = FindChrome();
        if (chrome == null)
            throw new InvalidOperationException("Google Chrome을 찾지 못했어요.\n\n이 컴퓨터에 Chrome을 설치한 뒤 ‘전시 시작’을 다시 실행해 주세요.\nhttps://www.google.com/chrome/");
        string networkError = CheckWebsite();
        if (networkError != null)
            throw new InvalidOperationException("전시 웹사이트에 연결하지 못했어요.\n\n인터넷 연결과 전시장 Wi-Fi의 로그인 화면을 확인한 뒤 다시 실행해 주세요.\nChrome에서 아래 주소를 직접 열어 확인할 수도 있어요.\n\n" + SiteUrl + "\n\n" + networkError);
        Directory.CreateDirectory(ProfilePath);
        var start = new ProcessStartInfo(chrome,
            "--user-data-dir=" + Quote(ProfilePath) + " --no-first-run --no-default-browser-check --start-fullscreen --app=" + Quote(SiteUrl));
        start.UseShellExecute = false;
        start.WorkingDirectory = Path.GetDirectoryName(chrome);
        Process launched = Process.Start(start);
        if (launched == null) throw new InvalidOperationException("Chrome 창을 열지 못했어요. 잠시 후 다시 실행해 주세요.");
        launched.Dispose();
    }

    private static void StopExhibition()
    {
        var instances = FindExhibitionBrowsers();
        foreach (var instance in instances)
        {
            using (Process process = GetVerifiedProcess(instance))
            {
                if (process == null) continue;
                process.CloseMainWindow();
                if (process.WaitForExit(4000)) continue;
            }
            // Re-read identity and the exact profile before the fallback. Never kill
            // by name, by stale PID, or by an unverified process-tree relationship.
            using (Process process = GetVerifiedProcess(instance))
            {
                if (process == null) continue;
                process.Kill();
                process.WaitForExit(3000);
            }
        }
    }

    private static string CheckWebsite()
    {
        try
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            var request = (HttpWebRequest)WebRequest.Create(SiteUrl);
            request.Method = "GET";
            request.Timeout = 6000;
            request.ReadWriteTimeout = 6000;
            request.UserAgent = "PlusPsychology-ExhibitionLauncher/1.0";
            using (var response = (HttpWebResponse)request.GetResponse())
            {
                if ((int)response.StatusCode < 200 || (int)response.StatusCode >= 400) return "웹사이트 응답: " + (int)response.StatusCode;
            }
            return null;
        }
        catch (WebException error) { return "연결 상태: " + error.Status; }
        catch (Exception error) { return "연결 확인 실패: " + error.GetType().Name; }
    }

    private static string FindChrome()
    {
        var candidates = new List<string>();
        foreach (RegistryHive hive in new[] {RegistryHive.CurrentUser, RegistryHive.LocalMachine})
        foreach (RegistryView view in new[] {RegistryView.Registry64, RegistryView.Registry32})
        {
            try
            {
                using (var registry = RegistryKey.OpenBaseKey(hive, view))
                using (var entry = registry.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"))
                    if (entry != null) candidates.Add(Convert.ToString(entry.GetValue(null)));
            }
            catch (System.Security.SecurityException) { }
            catch (UnauthorizedAccessException) { }
        }
        foreach (string directory in new[] {Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetEnvironmentVariable("ProgramFiles(x86)"), Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)})
            if (!String.IsNullOrEmpty(directory)) candidates.Add(Path.Combine(directory, @"Google\Chrome\Application\chrome.exe"));
        foreach (string candidate in candidates)
        {
            if (String.IsNullOrWhiteSpace(candidate)) continue;
            string value = Environment.ExpandEnvironmentVariables(candidate.Trim().Trim('"'));
            if (File.Exists(value) && String.Equals(Path.GetFileName(value), "chrome.exe", StringComparison.OrdinalIgnoreCase)) return Path.GetFullPath(value);
        }
        return null;
    }

    private static List<BrowserInstance> FindExhibitionBrowsers()
    {
        var found = new List<BrowserInstance>();
        try
        {
            using (var query = new ManagementObjectSearcher("SELECT ProcessId, CommandLine, ExecutablePath FROM Win32_Process WHERE Name = 'chrome.exe'"))
            using (var items = query.Get())
            foreach (ManagementObject item in items)
            {
                using (item)
                {
                    string command = item["CommandLine"] as string;
                    if (!IsExhibitionCommand(command, ProfilePath)) continue;
                    int id = Convert.ToInt32(item["ProcessId"]);
                    try
                    {
                        using (var process = Process.GetProcessById(id))
                        {
                            if (process.HasExited) continue;
                            found.Add(new BrowserInstance {Id = id, StartTicks = process.StartTime.ToUniversalTime().Ticks,
                                Executable = item["ExecutablePath"] as string});
                        }
                    }
                    catch (ArgumentException) { }
                    catch (InvalidOperationException) { }
                }
            }
        }
        catch (ManagementException)
        {
            throw new InvalidOperationException("전시용 Chrome 창을 구분하지 못했어요.\n다른 Chrome 창을 보호하기 위해 작업을 멈췄습니다.\n전시 창에서 Alt+F4로 닫은 뒤 다시 시도해 주세요.");
        }
        return found;
    }

    private static Process GetVerifiedProcess(BrowserInstance expected)
    {
        var current = FindExhibitionBrowsers().FirstOrDefault(item => item.Id == expected.Id && item.StartTicks == expected.StartTicks
            && String.Equals(item.Executable, expected.Executable, StringComparison.OrdinalIgnoreCase));
        if (current == null) return null;
        try
        {
            Process process = Process.GetProcessById(current.Id);
            if (!process.HasExited && process.StartTime.ToUniversalTime().Ticks == current.StartTicks) return process;
            process.Dispose();
        }
        catch (ArgumentException) { }
        catch (InvalidOperationException) { }
        return null;
    }

    internal static bool IsExhibitionCommand(string command, string profile)
    {
        if (String.IsNullOrWhiteSpace(command)) return false;
        string[] args = SplitCommandLine(command);
        if (args.Length == 0 || !String.Equals(Path.GetFileName(args[0]), "chrome.exe", StringComparison.OrdinalIgnoreCase)) return false;
        string selected = null;
        for (int index = 1; index < args.Length; index++)
        {
            string arg = args[index];
            if (arg.Equals("--type", StringComparison.OrdinalIgnoreCase) || arg.StartsWith("--type=", StringComparison.OrdinalIgnoreCase)) return false;
            if (arg.StartsWith("--user-data-dir=", StringComparison.OrdinalIgnoreCase))
            {
                if (selected != null) return false;
                selected = arg.Substring("--user-data-dir=".Length);
            }
            else if (arg.Equals("--user-data-dir", StringComparison.OrdinalIgnoreCase))
            {
                if (selected != null || index + 1 >= args.Length) return false;
                selected = args[++index];
            }
        }
        if (String.IsNullOrWhiteSpace(selected) || !Path.IsPathRooted(selected)) return false;
        try { return String.Equals(NormalizeDirectory(selected), NormalizeDirectory(profile), StringComparison.OrdinalIgnoreCase); }
        catch (ArgumentException) { return false; }
        catch (NotSupportedException) { return false; }
        catch (PathTooLongException) { return false; }
    }

    private static string NormalizeDirectory(string value) { return Path.GetFullPath(value).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }
    private static string Quote(string value) { return "\"" + value.Replace("\"", "\\\"") + "\""; }
    private static string[] SplitCommandLine(string command)
    {
        int count;
        IntPtr pointer = CommandLineToArgvW(command, out count);
        if (pointer == IntPtr.Zero) return new string[0];
        try
        {
            var args = new string[count];
            for (int index = 0; index < count; index++) args[index] = Marshal.PtrToStringUni(Marshal.ReadIntPtr(pointer, index * IntPtr.Size));
            return args;
        }
        finally { LocalFree(pointer); }
    }

    private static object SelfTest()
    {
        string profile = @"C:\Users\전시 운영\AppData\Local\PlusPsychology\MindForestExhibition\ChromeProfile";
        string chrome = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
        var tests = new[] {
            new {name="quoted_profile", command=Quote(chrome)+" --user-data-dir="+Quote(profile), expected=true},
            new {name="separate_argument", command=Quote(chrome)+" --user-data-dir "+Quote(profile), expected=true},
            new {name="case_insensitive", command=Quote(chrome)+" --user-data-dir="+Quote(profile.ToUpperInvariant()), expected=true},
            new {name="ordinary_browser", command=Quote(chrome)+" --app="+SiteUrl, expected=false},
            new {name="other_profile", command=Quote(chrome)+" --user-data-dir="+Quote(profile+"-other"), expected=false},
            new {name="profile_text_in_url", command=Quote(chrome)+" --app="+Quote("https://example.com/?path="+profile), expected=false},
            new {name="renderer", command=Quote(chrome)+" --type=renderer --user-data-dir="+Quote(profile), expected=false},
            new {name="gpu", command=Quote(chrome)+" --type gpu-process --user-data-dir="+Quote(profile), expected=false},
            new {name="duplicate_profile", command=Quote(chrome)+" --user-data-dir="+Quote(profile)+" --user-data-dir=C:\\Other", expected=false},
            new {name="different_executable", command="not-chrome.exe --user-data-dir="+Quote(profile), expected=false},
            new {name="relative_profile", command=Quote(chrome)+" --user-data-dir=ChromeProfile", expected=false},
            new {name="empty_command", command="", expected=false}
        };
        foreach (var item in tests)
            if (IsExhibitionCommand(item.command, profile) != item.expected) throw new InvalidOperationException("Self-test failed: " + item.name);
        return new {ok=true, action="self_test_only_no_browser_started_or_closed", tests=tests.Length, names=tests.Select(item => item.name).ToArray()};
    }
}
