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
extern "user32" fn MoveWindow(hWnd: ?*anyopaque, X: i32, Y: i32, nWidth: i32, nHeight: i32, bRepaint: i32) callconv(.winapi) i32;
extern "user32" fn ShowWindow(hWnd: ?*anyopaque, nCmdShow: i32) callconv(.winapi) i32;
extern "user32" fn IsZoomed(hWnd: ?*anyopaque) callconv(.winapi) i32;

fn enumWindowsProc(hwnd: ?*anyopaque, lParam: isize) callconv(.winapi) i32 {
    var title: [128]u8 = undefined;
    const len = GetWindowTextA(hwnd, &title, 128);
    if (len >= 8) {
        var i: usize = 0;
        while (i + 4 <= @as(usize, @intCast(len))) : (i += 1) {
            if (title[i] == 'N' and title[i + 1] == 'e' and title[i + 2] == 't' and title[i + 3] == 's') {
                const sw: i32 = @intCast((@as(usize, @bitCast(lParam)) >> 16) & 0xFFFF);
                const sh: i32 = @intCast(@as(usize, @bitCast(lParam)) & 0xFFFF);
                if (IsZoomed(hwnd) != 0) {
                    _ = ShowWindow(hwnd, 9); // SW_RESTORE
                }
                if (sw < 640) {
                    _ = MoveWindow(hwnd, 4, 4, sw - 8, sh - 36, 1);
                } else {
                    _ = MoveWindow(hwnd, 80, 12, sw - 96, sh - 48, 1);
                }
                break;
            }
        }
    }
    return 1;
}

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
                    if (nw >= 360 and nh >= 480 and (nw != curW or nh != curH)) {
                        var dm = DEVMODEA{};
                        dm.dmPelsWidth = nw;
                        dm.dmPelsHeight = nh;
                        dm.dmBitsPerPel = 16;
                        dm.dmFields = 0x00080000 | 0x00100000; // DM_PELSWIDTH | DM_PELSHEIGHT
                        const rc = ChangeDisplaySettingsA(&dm, 0);
                        if (rc == 0) {
                            curW = nw;
                            curH = nh;
                            const lparam: isize = @bitCast((@as(usize, nw) << 16) | @as(usize, nh));
                            _ = EnumWindows(&enumWindowsProc, lparam);
                            serialWrite("RESCHG_OK\n");
                        } else {
                            serialWrite("RESCHG_ERR\n");
                        }
                    }
                }
                pos = 0;
            } else if (pos < 60) {
                buf[pos] = c;
                pos += 1;
            }
        } else {
            Sleep(50);
        }
    }
}
