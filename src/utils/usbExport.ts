/**
 * USB Package Generator
 * Creates an authentic root directory structure for Sony Walkman, Nokia, and PSP
 * so users can extract directly onto their device drive or SD card.
 */

import JSZip from 'jszip';
import { ConvertedOutput } from '../types/converter';

export async function createDeviceUsbZip(output: ConvertedOutput): Promise<Blob> {
  const zip = new JSZip();
  const preset = output.preset;
  const fileName = output.filename;
  const videoBlob = output.blob;

  if (preset.category === 'walkman') {
    // Sony Walkman standard structure
    const videoFolder = zip.folder('WALKMAN')?.folder('VIDEO');
    if (videoFolder) {
      videoFolder.file(fileName, videoBlob);
      videoFolder.file(
        'SONY_WALKMAN_TRANSFER_INSTRUCTIONS.txt',
        `===================================================\r\n` +
        `SONY WALKMAN NW-A25 / NWZ SERIES VIDEO TRANSFER GUIDE\r\n` +
        `===================================================\r\n\r\n` +
        `File Name: ${fileName}\r\n` +
        `Resolution: ${output.width} x ${output.height} (QVGA)\r\n` +
        `Framerate: ${output.fps} FPS\r\n` +
        `Container: Fast-Start MP4 (AVC Baseline Profile Level 3.0)\r\n\r\n` +
        `INSTRUCTIONS:\r\n` +
        `1. Connect your Walkman to your computer using the Sony WM-PORT USB cable.\r\n` +
        `2. On the Walkman screen, if prompted, select USB Storage / File Transfer.\r\n` +
        `3. Your computer will display a drive named "WALKMAN" (and MicroSD if inserted).\r\n` +
        `4. Copy this file directly into the "VIDEO" folder on the WALKMAN drive:\r\n` +
        `   [WALKMAN DRIVE]:\\VIDEO\\${fileName}\r\n` +
        `5. Safely disconnect / eject the USB cable.\r\n` +
        `6. On the Walkman Home menu, select "Videos" → All Videos → enjoy smooth offline playback!\r\n`
      );
    }
  } else if (preset.category === 'nokia') {
    // Nokia Series 40 / Symbian S60 structure
    const videosFolder = zip.folder('NOKIA_MEMORY_CARD')?.folder('Videos');
    if (videosFolder) {
      videosFolder.file(fileName, videoBlob);
      videosFolder.file(
        'NOKIA_TRANSFER_README.txt',
        `===================================================\r\n` +
        `NOKIA ${preset.name.toUpperCase()} TRANSFER GUIDE\r\n` +
        `===================================================\r\n\r\n` +
        `File Name: ${fileName}\r\n` +
        `Resolution: ${output.width} x ${output.height}\r\n` +
        `Framerate: ${output.fps} FPS\r\n` +
        `Container: ${output.encodingOptions.container.toUpperCase()} (H.264 Baseline)\r\n\r\n` +
        `INSTRUCTIONS:\r\n` +
        `1. Connect your Nokia phone via Mini-USB / Micro-USB cable.\r\n` +
        `2. On your phone screen, choose "Data storage" or "Mass storage" mode.\r\n` +
        `   (Alternatively, place your MicroSD card into an SD card reader on your PC).\r\n` +
        `3. Open the Memory Card drive and drop ${fileName} into the "Videos" folder:\r\n` +
        `   [MEMORY CARD]:\\Videos\\${fileName}\r\n` +
        `4. Eject card or unplug USB.\r\n` +
        `5. On the phone, go to Menu → Gallery → Video clips, select the clip and press Play!\r\n`
      );
    }
  } else if (preset.category === 'psp') {
    // Sony PSP structure
    const pspVideo = zip.folder('PSP')?.folder('VIDEO');
    if (pspVideo) {
      pspVideo.file(fileName, videoBlob);
    }
    const legacyFolder = zip.folder('MP_ROOT')?.folder('100MNV01');
    if (legacyFolder) {
      legacyFolder.file('M4V00001.MP4', videoBlob);
      legacyFolder.file(
        'PSP_TRANSFER_NOTES.txt',
        `PSP FIRMWARE INSTRUCTIONS:\r\n` +
        `- For PSP Firmware 3.00+: Place file in Memory Stick:\\VIDEO\\${fileName}\r\n` +
        `- For PSP Firmware 1.50-2.80: Place file in Memory Stick:\\MP_ROOT\\100MNV01\\M4V00001.MP4\r\n`
      );
    }
  } else {
    // Generic PMP
    const rootFolder = zip.folder(preset.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase());
    if (rootFolder) {
      rootFolder.file(fileName, videoBlob);
      rootFolder.file(
        'DEVICE_TRANSFER_NOTE.txt',
        `File: ${fileName}\r\nResolution: ${output.width}x${output.height}\r\nCopy to your player's VIDEO or MOVIE folder.`
      );
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
