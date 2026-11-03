// The site Netscape Navigator 3.0 browses inside the VM at http://lexo.cool/, as HTML 3.2.
// The page serves it to the guest; the VM generator (tools/vm/snapshot.ts) serves the same
// homepage while it records the disk reads of the boot after the saved state.
const NAV_BAR = `
<TR><TD BGCOLOR="#DFDFDF" ALIGN="CENTER">
<FONT SIZE="-1">
<B>[ <A HREF="http://lexo.cool/">Home</A> ]</B> &nbsp;|&nbsp;
<B>[ <A HREF="http://lexo.cool/projects.html">Open Source Projects</A> ]</B> &nbsp;|&nbsp;
<B>[ <A HREF="http://lexo.cool/about.html">About &amp; Notes</A> ]</B> &nbsp;|&nbsp;
<B>[ <A HREF="http://lexo.cool/photos.html">Photo Album</A> ]</B> &nbsp;|&nbsp;
<B>[ <A HREF="http://github.com/lexoliu">GitHub (@lexoliu)</A> ]</B>
</FONT>
</TD></TR>`;

export function wrapHtml32(title, subtitle, bodyContent) {
  return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<HTML>
<HEAD>
<TITLE>${title}</TITLE>
</HEAD>
<BODY BGCOLOR="#C0C0C0" TEXT="#000000" LINK="#0000EE" VLINK="#551A8B" ALINK="#FF0000">
<CENTER>
<TABLE WIDTH="96%" BORDER="2" CELLPADDING="8" CELLSPACING="0" BGCOLOR="#FFFFFF">
<TR><TD BGCOLOR="#000080">
<TABLE WIDTH="100%" BORDER="0" CELLPADDING="0" CELLSPACING="0">
<TR>
<TD><FONT COLOR="#FFFFFF" SIZE="+1"><B>${subtitle}</B></FONT></TD>
<TD ALIGN="RIGHT"><FONT COLOR="#FFFF00" SIZE="-1"><B>[Est. 2006 / Rustacean]</B></FONT></TD>
</TR>
</TABLE>
</TD></TR>
${NAV_BAR}
<TR><TD>
${bodyContent}
<P ALIGN="CENTER">
<FONT SIZE="-2" COLOR="#555555">Best viewed with <B>Netscape Navigator 3.0</B> at 1024x768 &middot; Powered by v86 Windows 95 Virtual Machine</FONT>
</P>
</TD></TR>
</TABLE>
</CENTER>
</BODY>
</HTML>`;
}

/**
 * The images the pages embed: the guest's path on lexo.cool -> the file under public/vm that
 * tools/vm/logos.ts generates from the pinned GitHub organisation avatars (Netscape 3.0 decodes
 * GIF and baseline JPEG, not PNG). The page and the VM generator both serve exactly these.
 */
export const GUEST_IMAGES = {
  "/logos/waterui.jpg": "logos/waterui.jpg",
  "/logos/may.jpg": "logos/may.jpg",
  "/logos/skyzen.jpg": "logos/skyzen.jpg",
};
export const GUEST_IMAGE_TYPE = "image/jpeg";
/**
 * Netscape handles mailto: links itself (its own composer), so email links point at this route
 * instead: the page opens the visitor's mail client for the address after it, the generator
 * only answers the request.
 */
export const MAIL_ROUTE = "/mail/";
/** The address a guest request path asks the visitor's mail client for, or undefined. */
export function mailAddressOf(pathname) {
  return pathname.startsWith(MAIL_ROUTE) ? decodeURIComponent(pathname.slice(MAIL_ROUTE.length)) : undefined;
}
/** Side of the square logos, in pixels. */
export const LOGO_SIZE = 64;

function projectCard(name, logo, href, description, repo) {
  return `<TR>
<TD WIDTH="${LOGO_SIZE + 12}" ALIGN="CENTER" VALIGN="MIDDLE" BGCOLOR="#FFFFFF"><A HREF="${href}"><IMG SRC="http://lexo.cool${logo}" WIDTH="${LOGO_SIZE}" HEIGHT="${LOGO_SIZE}" BORDER="0" ALT="${name} logo"></A></TD>
<TD WIDTH="100%" VALIGN="MIDDLE"><B><A HREF="${href}">${name}</A></B><BR>${description} (<TT>${repo}</TT>)</TD>
</TR>`;
}

export const PAGES = {
  "/": wrapHtml32(
    "Lexo Liu - Personal Home Page (http://lexo.cool/)",
    "Lexo Liu's Personal Home Page - lexo.cool",
    `<FONT SIZE="+2"><B>Hello, I'm Lexo.</B></FONT>
<HR SIZE="2">
<UL>
<LI>I'm a <B>CS undergraduate</B> studying in the US, and my hometown is <B>Hangzhou</B>.
<LI>I'm working on <A HREF="http://github.com/May-Agent/may"><B>May</B></A>, <A HREF="http://github.com/water-rs/waterui"><B>WaterUI</B></A> (a cross-platform GUI kit in Rust), and <A HREF="http://github.com/zen-rs/skyzen"><B>Skyzen</B></A>.
<LI>I'm a <B>Rustacean</B> who has been learning &amp; building with Rust for <B>6 years</B>.
<LI>I'm also keen to meet people from different backgrounds, so feel free to drop me a message :)
</UL>
<HR SIZE="1">
<B>About Me:</B>
<BLOCKQUOTE>
<I>"I am but a phantom... Random ideas flash through my mind all the time. I jot them down in a blazing beat, resulting in quite a mess. My work involves sifting through this mess to find something valuable. It is what I do."</I>
</BLOCKQUOTE>
<HR SIZE="1">
<TABLE WIDTH="100%" BORDER="1" CELLPADDING="6" CELLSPACING="0" BGCOLOR="#F4F4F4">
${projectCard("WaterUI", "/logos/waterui.jpg", "http://github.com/water-rs/waterui", "Cross-platform reactive GUI framework written in Rust", "github.com/water-rs/waterui")}
${projectCard("May", "/logos/may.jpg", "http://github.com/May-Agent/may", "Next-generation agentic project", "github.com/May-Agent/may")}
${projectCard("Skyzen", "/logos/skyzen.jpg", "http://github.com/zen-rs/skyzen", "Ergonomic, fast HTTP framework in Rust", "github.com/zen-rs/skyzen")}
<TR><TD ALIGN="CENTER"><B>Contact</B></TD><TD WIDTH="100%">Twitter: <A HREF="http://twitter.com/is_lexo">@is_lexo</A> &nbsp;|&nbsp; GitHub: <A HREF="http://github.com/lexoliu">@lexoliu</A> &nbsp;|&nbsp; Email: <A HREF="http://lexo.cool${MAIL_ROUTE}me@lexo.cool">me@lexo.cool</A></TD></TR>
</TABLE>`
  ),

  "/projects.html": wrapHtml32(
    "Lexo Liu - Open Source Projects",
    "Lexo's Open Source Rust & Systems Projects",
    `<FONT SIZE="+1"><B>Featured Open Source Projects</B></FONT>
<HR SIZE="2">
<TABLE WIDTH="100%" BORDER="2" CELLPADDING="8" CELLSPACING="0" BGCOLOR="#F8F8F8">
<TR BGCOLOR="#008080">
<TH ALIGN="LEFT"><FONT COLOR="#FFFFFF">Repository</FONT></TH>
<TH ALIGN="LEFT"><FONT COLOR="#FFFFFF">Overview</FONT></TH>
<TH ALIGN="CENTER"><FONT COLOR="#FFFFFF">Inspect</FONT></TH>
</TR>
<TR>
<TD VALIGN="TOP"><B>water-rs / WaterUI</B><BR><FONT SIZE="-1" COLOR="#555555">Rust / GUI</FONT></TD>
<TD VALIGN="TOP">A modern, cross-platform reactive GUI kit written in pure Rust. Designed for ergonomics, native rendering, and zero-cost abstractions.</TD>
<TD VALIGN="TOP" ALIGN="CENTER"><A HREF="http://github.com/water-rs/waterui"><B>[View Repo]</B></A></TD>
</TR>
<TR>
<TD VALIGN="TOP"><B>May-Agent / May</B><BR><FONT SIZE="-1" COLOR="#555555">AI / Systems</FONT></TD>
<TD VALIGN="TOP">Agentic runtime and workspace orchestrator designed for autonomous software engineering workflows.</TD>
<TD VALIGN="TOP" ALIGN="CENTER"><A HREF="http://github.com/May-Agent/may"><B>[View Repo]</B></A></TD>
</TR>
<TR>
<TD VALIGN="TOP"><B>zen-rs / Skyzen</B><BR><FONT SIZE="-1" COLOR="#555555">Rust / HTTP</FONT></TD>
<TD VALIGN="TOP">Fast, modular, and type-safe async HTTP web framework for the Rust ecosystem.</TD>
<TD VALIGN="TOP" ALIGN="CENTER"><A HREF="http://github.com/zen-rs/skyzen"><B>[View Repo]</B></A></TD>
</TR>
</TABLE>
<P>
<FONT SIZE="-1">Tip: Clicking any GitHub link above opens the repository in your browser.</FONT>`
  ),

  "/about.html": wrapHtml32(
    "Lexo Liu - About & Philosophy",
    "About Lexo Liu - Notes from Cyberspace",
    `<FONT SIZE="+1"><B>Background &amp; Philosophy</B></FONT>
<HR SIZE="2">
<P>Hi! I'm <B>Lexo Liu</B>, currently pursuing my undergraduate degree in Computer Science in the United States, originally from <B>Hangzhou, China</B>.
<P>I have been writing <B>Rust</B> for over 6 years, focusing on UI toolkits (<B>WaterUI</B>), web/network infrastructure (<B>Skyzen</B>), and developer tooling.
<BLOCKQUOTE>
<I>"I am but a phantom... Random ideas flash through my mind all the time. I jot them down in a blazing beat, resulting in quite a mess. My work involves sifting through this mess to find something valuable. It is what I do."</I>
</BLOCKQUOTE>`
  ),

  "/photos.html": wrapHtml32(
    "Lexo Liu - Photo Album",
    "Lexo's Retro Cyberspace Photo Album",
    `<FONT SIZE="+1"><B>Photo Categories</B></FONT>
<HR SIZE="2">
<P>Welcome to the low-bandwidth HTML 3.2 edition of my photo archive:
<TABLE WIDTH="100%" BORDER="1" CELLPADDING="8" CELLSPACING="0" BGCOLOR="#F4F4F4">
<TR BGCOLOR="#000080">
<TH ALIGN="LEFT"><FONT COLOR="#FFFFFF">Album</FONT></TH>
<TH ALIGN="LEFT"><FONT COLOR="#FFFFFF">Description</FONT></TH>
</TR>
<TR>
<TD><B>[Travel]</B></TD>
<TD>Snapshots from Hangzhou, US college towns, and road trips across coast-to-coast flights.</TD>
</TR>
<TR>
<TD><B>[Kitchen]</B></TD>
<TD>Late-night home cooking experiments after long Rust compilation sessions.</TD>
</TR>
<TR>
<TD><B>[Misc &amp; Hardware]</B></TD>
<TD>Retro computing setups, mechanical keyboards, and random sparks of inspiration.</TD>
</TR>
</TABLE>
<P><A HREF="http://lexo.cool/">&laquo; Return to Home Page</A>`
  ),
};
