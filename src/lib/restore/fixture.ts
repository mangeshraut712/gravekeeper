/**
 * Lantern Hill — original Gravekeeper demo fixture.
 *
 * This is not a copy of a third-party site. It is an original late-1990s
 * personal-homepage imitation, written for the Resurrection demo and covered
 * by the repository MIT license. The resurrect path for this URL is fully
 * local: it does not call the Wayback Machine or GitHub.
 */

export const LANTERN_HILL_ID = 'lantern-hill';

export const LANTERN_HILL_URL = 'https://fixtures.gravekeeper.dev/lantern-hill/';

export const LANTERN_HILL_BEFORE_PATH = '/fixtures/lantern-hill/before';

export const LANTERN_HILL_AFTER_PATH = '/fixtures/lantern-hill/after';

export const LANTERN_HILL_TITLE = 'Lantern Hill — Ada\'s Page';

export const LANTERN_HILL_LICENSE = 'MIT';

export const LANTERN_HILL_DISCLOSURE =
  'Original Gravekeeper demo fixture. It imitates a personal homepage last updated 14 March 1999. It is not a copy or restoration of a copyrighted third-party site, and it is covered by the MIT license on this repository.';

export const LANTERN_HILL_HTML = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">
<title>Lantern Hill — Ada's Page</title>
</head>
<!--
  Lantern Hill is an original Gravekeeper demo fixture.
  It imitates a 1999 personal homepage and is not copied from a copyrighted site.
  License: MIT, same as the Gravekeeper repository.
-->
<body bgcolor="#000080" text="#ffff00" link="#00ffff" vlink="#ff00ff">
<center>
<font face="Comic Sans MS, cursive" size="7" color="#ffff00">Lantern Hill</font>
<br><br>
<font size="4">A homepage from the modem years. Last updated 14 March 1999.</font>
<br><br>
<marquee behavior="scroll" direction="left">Welcome to my corner of the web! Sign the guestbook!</marquee>
</center>
<br>
<table border="0" width="100%" cellpadding="8">
<tr>
<td width="30%" bgcolor="#000040" valign="top">
<font face="Arial" color="#ffffff">
<b>Navigate</b><br>
<a href="#about">About</a><br>
<a href="#webring">Webring</a><br>
<a href="#guestbook">Guestbook</a>
</font>
</td>
<td bgcolor="#191970" valign="top">
<font face="Times New Roman, serif" color="#ffffcc">
<a name="about"></a>
<b><font size="5">About this page</font></b>
<br><br>
This page is an original Gravekeeper demo fixture. It imitates a late-1990s personal homepage so a restorer has a dead document to modernize. It is not a copy of anyone else's site.
<br><br>
<blink>You are visitor number 000042</blink>
<br><br>
Best viewed in Netscape Navigator 4 at 800x600.
<br><br>
<a name="webring"></a>
<b>Under construction</b>
<br>
The lantern webring is closed. The GIF buttons were never uploaded.
</font>
</td>
</tr>
</table>
<br>
<center>
<a name="guestbook"></a>
<font size="5">Sign the guestbook</font>
<br>
<form action="mailto:ada@lantern-hill.example" method="post" enctype="text/plain">
Name: <input type="text" name="name"><br>
Note: <input type="text" name="note"><br>
<input type="submit" value="Sign">
</form>
</center>
<br>
<script language="JavaScript">
document.write("Page generated " + document.lastModified);
</script>
<hr>
<center><font size="1">Copyright 1999 Ada Morrow. Original demo fixture, MIT License.</font></center>
</body>
</html>
`;

export type DemoFixture = {
  id: string;
  url: string;
  title: string;
  license: string;
  disclosure: string;
  beforeHtml: string;
  beforePath: string;
  afterPath: string;
};

export function isFixtureUrl(input: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.hostname !== 'fixtures.gravekeeper.dev') return false;
  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  return path === '/lantern-hill';
}

export function loadLanternHill(): DemoFixture {
  return {
    id: LANTERN_HILL_ID,
    url: LANTERN_HILL_URL,
    title: LANTERN_HILL_TITLE,
    license: LANTERN_HILL_LICENSE,
    disclosure: LANTERN_HILL_DISCLOSURE,
    beforeHtml: LANTERN_HILL_HTML,
    beforePath: LANTERN_HILL_BEFORE_PATH,
    afterPath: LANTERN_HILL_AFTER_PATH,
  };
}
