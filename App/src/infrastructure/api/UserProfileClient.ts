import { BASE_URL, USER_AGENT, USE_STAGING, STAGING_AUTH } from './config';
import type { UserProfile } from '../../types/UserProfile';

export class UserProfileFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserProfileFetchError';
  }
}

export class UserProfileClient {
  async fetchProfile(username: string): Promise<UserProfile> {
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
    };
    if (USE_STAGING) {
      headers['Authorization'] = STAGING_AUTH;
    }

    const [html, editsCount, photosCount, createdCount, scannedCount] = await Promise.allSettled([
      this.fetchHtml(username, headers),
      this.fetchProductCount('editors', username, headers),
      this.fetchProductCount('photographers', username, headers),
      this.fetchProductCount('owner', username, headers),
      this.fetchProductCount('scanners', username, headers),
    ]);

    return {
      username,
      joinDate: html.status === 'fulfilled' ? this.extractJoinDate(html.value) : null,
      productsEdited: editsCount.status === 'fulfilled' ? editsCount.value : null,
      photosUploaded: photosCount.status === 'fulfilled' ? photosCount.value : null,
      productsAdded: createdCount.status === 'fulfilled' ? createdCount.value : null,
      productsScanned: scannedCount.status === 'fulfilled' ? scannedCount.value : null,
      profileUrl: `${BASE_URL}/user/${encodeURIComponent(username)}`,
    };
  }

  private async fetchHtml(username: string, headers: Record<string, string>): Promise<string> {
    const response = await fetch(`${BASE_URL}/user/${encodeURIComponent(username)}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      throw new UserProfileFetchError(`Server returned ${response.status}`);
    }
    return response.text();
  }

  private async fetchProductCount(
    tagType: string,
    username: string,
    headers: Record<string, string>
  ): Promise<number> {
    const params = new URLSearchParams({
      action: 'process',
      search_simple: '1',
      page_size: '1',
      json: '1',
    });
    params.append('tagtype_0', tagType);
    params.append('tag_contains_0', 'contains');
    params.append('tag_0', username);

    const url = `${BASE_URL}/cgi/search.pl?${params.toString()}`;
    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      throw new UserProfileFetchError(`Search returned ${response.status}`);
    }

    const data = (await response.json()) as { count?: number };
    return data.count ?? 0;
  }

  private extractJoinDate(html: string): string | null {
    const patterns = [
      /member\s*since\s*[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/i,
      /mitglied\s*seit\s*[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/i,
      /created_t["\s:]*["']?\s*(\d{4}-\d{2}-\d{2})/,
      /registered_t["\s:]*["']?\s*(\d{4}-\d{2}-\d{2})/,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }

    const dateText = /(\d{1,2})\s+([A-Za-zäöüß]+)\s+(\d{4})/.exec(html);
    if (dateText) {
      const months: Record<string, number> = {
        january: 1,
        jan: 1,
        januar: 1,
        february: 2,
        feb: 2,
        februar: 2,
        march: 3,
        mar: 3,
        märz: 3,
        april: 4,
        apr: 4,
        may: 5,
        mai: 5,
        june: 6,
        jun: 6,
        juni: 6,
        july: 7,
        jul: 7,
        juli: 7,
        august: 8,
        aug: 8,
        september: 9,
        sep: 9,
        october: 10,
        oct: 10,
        oktober: 10,
        okt: 10,
        november: 11,
        nov: 11,
        december: 12,
        dec: 12,
        dezember: 12,
        dez: 12,
      };
      const month = months[dateText[2].toLowerCase()];
      if (month) {
        return `${dateText[3]}-${String(month).padStart(2, '0')}-${String(dateText[1]).padStart(2, '0')}`;
      }
    }

    return null;
  }
}
