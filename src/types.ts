export type FileType = 'video' | 'audio' | 'image' | 'document' | 'archive' | 'other';

export interface ArchiveFile {
  name: string;
  format?: string;
  mimeType?: string;
  size?: number;
  md5?: string;
  mtime?: string;
  source?: string;
  type: FileType;
  downloadable: boolean;
  restricted: boolean;
  recommended: boolean;
  supportFile: boolean;
}

export interface ArchiveItem {
  identifier: string;
  title: string;
  description?: string;
  creator?: string;
  date?: string;
  files: ArchiveFile[];
}

export interface AnalysisResult extends ArchiveItem {
  recommendedFile?: string;
}
