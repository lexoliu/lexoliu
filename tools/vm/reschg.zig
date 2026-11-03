const std = @import("std");
const w = std.os.windows;

extern "kernel32" fn CreateFileA(
    lpFileName: [*:0]const u8,
    dwDesiredAccess: u32,
    dwShareMode: u32,
    lpSecurityAttributes: ?*anyopaque,
    dwCreationDisposition: u32,
    dwFlagsAndAttributes: u32,
    hTemplateFile: ?*anyopaque,
) callconv(.winapi) ?*anyopaque;

extern "kernel32" fn ReadFile(
    hFile: ?*anyopaque,
    lpBuffer: [*]u8,
    nNumberOfBytesToRead: u32,
    lpNumberOfBytesRead: *u32,
    lpOverlapped: ?*anyopaque,
) callconv(.winapi) i32;

extern "kernel32" fn WriteFile(
    hFile: ?*anyopaque,
    lpBuffer: [*]const u8,
    nNumberOfBytesToWrite: u32,
    lpNumberOfBytesWritten: *u32,
    lpOverlapped: ?*anyopaque,
) callconv(.winapi) i32;

extern "kernel32" fn Sleep(dwMilliseconds: u32) callconv(.winapi) void;
extern "kernel32" fn ExitProcess(uExitCode: u32) callconv(.winapi) noreturn;

inline fn outb(port: u16, val: u8) void {
    asm volatile ("outb %[val], %[port]"
        :
        : [val] "{al}" (val),
          [port] "{dx}" (port),
    );
}

inline fn inb(port: u16) u8 {
    return asm volatile ("inb %[port], %[ret]"
        : [ret] "={al}" (-> u8),
        : [port] "{dx}" (port),
    );
}

fn serialWrite(msg: []const u8) void {
    for (msg) |c| {
        outb(0x3F8, c);
    }
}

const DEVMODEA = extern struct {
    dmDeviceName: [32]u8 = [_]u8{0} ** 32,
    dmSpecVersion: u16 = 0x0400,
    dmDriverVersion: u16 = 0,
    dmSize: u16 = 148,
    dmDriverExtra: u16 = 0,
    dmFields: u32 = 0,
    dmOrientation: i16 = 0,
    dmPaperSize: i16 = 0,
    dmPaperLength: i16 = 0,
    dmPaperWidth: i16 = 0,
    dmScale: i16 = 0,
    dmCopies: i16 = 0,
    dmDefaultSource: i16 = 0,
    dmPrintQuality: i16 = 0,
    dmColor: i16 = 0,
    dmDuplex: i16 = 0,
    dmYResolution: i16 = 0,
    dmTTOption: i16 = 0,
    dmCollate: i16 = 0,
    dmFormName: [32]u8 = [_]u8{0} ** 32,
    dmLogPixels: u16 = 0,
    dmBitsPerPel: u32 = 16,
    dmPelsWidth: u32 = 0,
    dmPelsHeight: u32 = 0,
    dmDisplayFlags: u32 = 0,
    dmDisplayFrequency: u32 = 0,
    dmICMMethod: u32 = 0,
    dmICMIntent: u32 = 0,
    dmMediaType: u32 = 0,
    dmDitherType: u32 = 0,
    dmReserved1: u32 = 0,
    dmReserved2: u32 = 0,
};

extern "user32" fn ChangeDisplaySettingsA(lpDevMode: *const DEVMODEA, dwFlags: u32) callconv(.winapi) i32;

extern "user32" fn EnumWindows(lpEnumFunc: *const fn (?*anyopaque, isize) callconv(.winapi) i32, lParam: isize) callconv(.winapi) i32;
extern "user32" fn GetWindowTextA(hWnd: ?*anyopaque, lpString: [*]u8, nMaxCount: i32) callconv(.winapi) i32;
extern "user32" fn IsWindowVisible(hWnd: ?*anyopaque) callconv(.winapi) i32;
extern "user32" fn MoveWindow(hWnd: ?*anyopaque, X: i32, Y: i32, nWidth: i32, nHeight: i32, bRepaint: i32) callconv(.winapi) i32;
extern "user32" fn ShowWindow(hWnd: ?*anyopaque, nCmdShow: i32) callconv(.winapi) i32;
extern "user32" fn IsZoomed(hWnd: ?*anyopaque) callconv(.winapi) i32;

extern "user32" fn WindowFromPoint(x: i32, y: i32) callconv(.winapi) ?*anyopaque;
extern "user32" fn GetParent(hWnd: ?*anyopaque) callconv(.winapi) ?*anyopaque;
extern "user32" fn GetWindowLongA(hWnd: ?*anyopaque, nIndex: i32) callconv(.winapi) u32;
extern "user32" fn PostMessageA(hWnd: ?*anyopaque, msg: u32, wParam: usize, lParam: isize) callconv(.winapi) i32;

const GWL_STYLE = -16;
const WS_CHILD = 0x40000000;
const WS_HSCROLL = 0x00100000;
const WS_VSCROLL = 0x00200000;
const WM_HSCROLL = 0x0114;
const WM_VSCROLL = 0x0115;
const SB_LINEUP = 0; // SB_LINELEFT for WM_HSCROLL
const SB_LINEDOWN = 1; // SB_LINERIGHT for WM_HSCROLL
const SB_ENDSCROLL = 8;

/// Posts `lines` line scrolls (negative: up or left) to the nearest window at (x, y) or above it
/// with the scroll bar `bar` (WS_VSCROLL or WS_HSCROLL); posting never waits on the window.
fn scroll(x: i32, y: i32, lines: i32, bar: u32) void {
    var h = WindowFromPoint(x, y);
    while (h != null) {
        const style = GetWindowLongA(h, GWL_STYLE);
        if (style & bar != 0) {
            const msg: u32 = if (bar == WS_VSCROLL) WM_VSCROLL else WM_HSCROLL;
            const code: usize = if (lines < 0) SB_LINEUP else SB_LINEDOWN;
            var i: u32 = 0;
            while (i < @abs(lines)) : (i += 1) _ = PostMessageA(h, msg, code, 0);
            _ = PostMessageA(h, msg, SB_ENDSCROLL, 0);
            return;
        }
        if (style & WS_CHILD == 0) return;
        h = GetParent(h);
    }
}

/// The desktop to fit Netscape to, and whether its window was found.
const Fit = extern struct { w: i32, h: i32, found: i32 };

const MAIN_WINDOW_TITLE = "Netscape - [";

fn isNetscapeMainWindow(hwnd: ?*anyopaque) bool {
    var title: [MAIN_WINDOW_TITLE.len + 1]u8 = undefined; // GetWindowTextA writes a NUL
    const len = GetWindowTextA(hwnd, &title, title.len);
    return len == MAIN_WINDOW_TITLE.len and std.mem.eql(u8, title[0..MAIN_WINDOW_TITLE.len], MAIN_WINDOW_TITLE);
}

fn fitWindowProc(hwnd: ?*anyopaque, lParam: isize) callconv(.winapi) i32 {
    const fit: *Fit = @ptrFromInt(@as(usize, @bitCast(lParam)));
    if (IsWindowVisible(hwnd) == 0 or !isNetscapeMainWindow(hwnd)) return 1;
    if (IsZoomed(hwnd) != 0) {
        _ = ShowWindow(hwnd, 9); // SW_RESTORE
    }
    if (fit.w < 640) {
        _ = MoveWindow(hwnd, 4, 4, fit.w - 8, fit.h - 36, 1);
    } else {
        _ = MoveWindow(hwnd, 80, 12, fit.w - 96, fit.h - 48, 1);
    }
    fit.found = 1;
    return 1;
}

/// Fits Netscape's main window to the desktop; false when it is not open yet.
fn fitNetscape(width: u32, height: u32) bool {
    var fit = Fit{ .w = @intCast(width), .h = @intCast(height), .found = 0 };
    _ = EnumWindows(&fitWindowProc, @bitCast(@intFromPtr(&fit)));
    return fit.found != 0;
}

/// Fills `out` with the signed integers in `text`, in order.
fn parseInts(text: []const u8, out: []i32) void {
    var idx: usize = 0;
    for (out) |*slot| {
        while (idx < text.len and text[idx] != '-' and (text[idx] < '0' or text[idx] > '9')) : (idx += 1) {}
        const negative = idx < text.len and text[idx] == '-';
        if (negative) idx += 1;
        var v: i32 = 0;
        while (idx < text.len and text[idx] >= '0' and text[idx] <= '9') : (idx += 1) v = v * 10 + @as(i32, text[idx] - '0');
        slot.* = if (negative) -v else v;
    }
}

/// Idle sleeps between looks for a Netscape window opened after a switch.
const FIT_POLL_SLEEPS = 10;

pub export fn WinMainCRTStartup() callconv(.winapi) noreturn {
    // Initialize COM1 (0x3F8) 8N1
    outb(0x3F8 + 1, 0x00);
    outb(0x3F8 + 3, 0x03);
    outb(0x3F8 + 2, 0xC7);
    outb(0x3F8 + 4, 0x03);

    serialWrite("RESCHG_READY\n");

    var buf: [64]u8 = undefined;
    var pos: usize = 0;
    var curW: u32 = 0;
    var curH: u32 = 0;
    var idle: u32 = 0;
    var fitPending = false;

    while (true) {
        if ((inb(0x3F8 + 5) & 0x01) != 0) {
            const c = inb(0x3F8);
            if (c == '\n' or c == '\r') {
                if (pos >= 7 and buf[0] == 'R' and buf[1] == 'E' and buf[2] == 'S') {
                    var idx: usize = 3;
                    var nw: u32 = 0;
                    var nh: u32 = 0;
                    while (idx < pos and (buf[idx] < '0' or buf[idx] > '9')) : (idx += 1) {}
                    while (idx < pos and (buf[idx] >= '0' and buf[idx] <= '9')) : (idx += 1) {
                        nw = nw * 10 + (buf[idx] - '0');
                    }
                    while (idx < pos and (buf[idx] < '0' or buf[idx] > '9')) : (idx += 1) {}
                    while (idx < pos and (buf[idx] >= '0' and buf[idx] <= '9')) : (idx += 1) {
                        nh = nh * 10 + (buf[idx] - '0');
                    }
                    if (nw > 0 and nh > 0 and (nw != curW or nh != curH)) {
                        var dm = DEVMODEA{};
                        dm.dmPelsWidth = nw;
                        dm.dmPelsHeight = nh;
                        dm.dmBitsPerPel = 16;
                        dm.dmFields = 0x00080000 | 0x00100000; // DM_PELSWIDTH | DM_PELSHEIGHT
                        const rc = ChangeDisplaySettingsA(&dm, 0);
                        if (rc == 0) {
                            curW = nw;
                            curH = nh;
                            fitPending = !fitNetscape(nw, nh);
                            serialWrite("RESCHG_OK\n");
                        } else {
                            serialWrite("RESCHG_ERR\n");
                        }
                    }
                } else if (pos >= 8 and std.mem.eql(u8, buf[0..6], "SCROLL")) {
                    var args = [_]i32{ 0, 0, 0 };
                    parseInts(buf[6..pos], &args);
                    scroll(args[0], args[1], args[2], WS_VSCROLL);
                } else if (pos >= 9 and std.mem.eql(u8, buf[0..7], "HSCROLL")) {
                    var args = [_]i32{ 0, 0, 0 };
                    parseInts(buf[7..pos], &args);
                    scroll(args[0], args[1], args[2], WS_HSCROLL);
                }
                pos = 0;
            } else if (pos < 60) {
                buf[pos] = c;
                pos += 1;
            }
        } else {
            idle += 1;
            if (fitPending and idle % FIT_POLL_SLEEPS == 0) fitPending = !fitNetscape(curW, curH);
            Sleep(50);
        }
    }
}
