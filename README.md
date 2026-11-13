# Invitation

- Public invitation: https://ahmedadelabosaif.github.io/invitation/

GitHub Pages publishes only the guest-facing invitation. The editor files are
excluded from the Pages build, so `/admin.html` is not available to invitees.
GitHub Pages is static hosting and cannot password-protect an editor. Keep the
repository's write access limited to yourself; only someone with write access
and your local publishing token can change the published invitation.

To customize privately, run the editor on your own computer from the repository
root:

1. Run `python3 -m http.server 8000 --bind 127.0.0.1`.
2. Open `http://127.0.0.1:8000/admin.html` in your browser.
3. Stop the local server with Ctrl+C when finished.

The loopback-only server is not reachable by invitees. In the editor, use a
GitHub fine-grained personal access token limited to this repository with
**Contents: read and write** permission. The token is stored in this browser's
local storage for `127.0.0.1`; use **Forget token on this device** to remove it
and revoke the token in GitHub if it is no longer needed. Do not share the
token or commit it. Publishing updates `invitations.json` through GitHub, and
Pages automatically deploys the guest-facing invitation.

The public page uses the fixed Arabic wedding design without customization
controls. Enabled wedding sections include the verse, henna and privacy note,
lunch, marriage-contract photo, and parents’ invitation. The invitation’s
dates, names, copy, venue, safe map link, optional soundtrack, and custom colors
are rendered from the selected event.

The local editor keeps the Events selector separate from the page header and
protects the main invitation from deletion. Start with the couple’s names,
date, time, venue, and message. The live editor preview stays beside the form
and updates as you type. The public page follows its fixed reference design;
editor preview arrangement and theme presets do not change that design.

Use **Add event** to create another invitation, **Set as main invitation** to
choose what appears at the main link, and **View guest link** to open one
event. Wedding events support optional reference-design sections, such as the
opening verse, henna, lunch, parent invitation, and marriage-contract photo.
Optional sections appear on the public invitation only when enabled. Add a map
URL to show a directions link. Text fields support the editor’s formatting
controls. A direct HTTPS audio URL or uploaded audio file can supply the
soundtrack; video pages are not embedded or played. Guests use the single sound
button to mute or unmute after opening the invitation. Changes are drafts until
published.
Uploaded images and event data are public, so only use content you want to
share with guests.

The preset music recordings are served by Wikimedia Commons:
[Beethoven, Adagio cantabile](https://commons.wikimedia.org/wiki/File:Beethoven,_Sonata_No._8_in_C_Minor_Pathetique,_Op._13_-_II._Adagio_cantabile.ogg),
[Beethoven, 32 Variations](https://commons.wikimedia.org/wiki/File:Beethoven_-_32_Variations_in_C_Minor,_WoO_80.ogg),
[Chopin, Romance (Larghetto)](https://commons.wikimedia.org/wiki/File:Chopin_-_Piano_Concerto_no._1,_Op._11_(string_quartet)-2.ogg),
and [Beethoven, Adagio sostenuto](https://commons.wikimedia.org/wiki/File:Beethoven,_Piano_Sonata_No._29_in_B-flat_Major,_Op._106_Hammerklavier_-_III._Adagio_sostenuto.ogg).
