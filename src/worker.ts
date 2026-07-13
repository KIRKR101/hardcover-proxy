const HARDCOVER_API = 'https://api.hardcover.app/v1/graphql';
const CACHE_TTL = 7200;

interface Env {
  HARDCOVER_API_KEY: string;
}

interface Book {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  pages: number | null;
  release_date: string | null;
  release_year: number | null;
  rating: number | null;
  ratings_count: number;
  slug: string | null;
  image: { url: string } | null;
  contributions: Array<{ author: { name: string } }>;
  book_series: Array<{ series: { name: string } | null }>;
}

interface CurrentlyReadingItem {
  id: number;
  status_id: number;
  rating: number | null;
  date_added: string;
  read_count: number;
  owned: boolean;
  starred: boolean;
  review: string | null;
  first_started_reading_date: string | null;
  book: Book;
  edition: { pages: number | null } | null;
  user_book_reads: Array<{ progress_pages: number | null }>;
}

interface PreviouslyReadItem {
  id: number;
  status_id: number;
  rating: number | null;
  date_added: string;
  read_count: number;
  owned: boolean;
  starred: boolean;
  review: string | null;
  first_read_date: string | null;
  last_read_date: string | null;
  book: Book;
}

const CURRENTLY_READING_QUERY = `
  query CurrentlyReading {
    me {
      id
      username
      user_books(
        where: { status_id: { _eq: 2 } }
        order_by: { updated_at: desc }
        limit: 100
      ) {
        id
        status_id
        rating
        date_added
        read_count
        owned
        starred
        review
        first_started_reading_date
        edition {
          pages
        }
        user_book_reads {
          progress_pages
        }
        book {
          id
          title
          subtitle
          description
          pages
          release_date
          release_year
          rating
          ratings_count
          slug
          image {
            url
          }
          contributions {
            author {
              name
            }
          }
          book_series {
            series {
              name
            }
          }
        }
      }
    }
  }
`;

const PREVIOUSLY_READ_QUERY = `
  query PreviouslyRead {
    me {
      user_books(
        where: { status_id: { _eq: 3 } }
        order_by: { last_read_date: desc }
        limit: 100
      ) {
        id
        status_id
        rating
        date_added
        read_count
        owned
        starred
        review
        first_read_date
        last_read_date
        book {
          id
          title
          subtitle
          description
          pages
          release_date
          release_year
          rating
          ratings_count
          slug
          image {
            url
          }
          contributions {
            author {
              name
            }
          }
          book_series {
            series {
              name
            }
          }
        }
      }
    }
  }
`;

async function fetchHardcover(token: string, query: string): Promise<any> {
  const response = await fetch(HARDCOVER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  const responseBody = await response.text();
  
  if (!response.ok) {
    throw new Error(`Hardcover API error: ${response.status} - ${responseBody}`);
  }

  const result = JSON.parse(responseBody) as {
    data?: unknown;
    errors?: Array<{ message: string }>;
  };
  if (result.errors) {
    throw new Error(`GraphQL error: ${result.errors[0].message}`);
  }

  return result.data;
}

function mapCurrentlyReading(item: CurrentlyReadingItem) {
  const progressPages = item.user_book_reads?.[0]?.progress_pages;
  const totalPages = item.edition?.pages || item.book.pages;
  const percentage =
    progressPages && totalPages
      ? Math.round((progressPages / totalPages) * 100)
      : null;

  return {
    book: {
      id: item.book.id,
      title: item.book.title,
      subtitle: item.book.subtitle,
      description: item.book.description,
      pages: item.book.pages,
      release_date: item.book.release_date,
      release_year: item.book.release_year,
      rating: item.book.rating,
      ratings_count: item.book.ratings_count,
      slug: item.book.slug,
      cover_url: item.book.image?.url || null,
      authors: item.book.contributions?.map((c) => c.author.name) || [],
      series:
        item.book.book_series
          ?.map((bs) => bs.series?.name)
          .filter(Boolean) || [],
    },
    user_book: {
      status: 'currently_reading',
      rating: item.rating,
      date_added: item.date_added,
      started_reading: item.first_started_reading_date,
      read_count: item.read_count,
      owned: item.owned,
      starred: item.starred,
      review: item.review,
    },
    progress: {
      pages_read: progressPages,
      total_pages: totalPages,
      percentage,
    },
  };
}

function mapPreviouslyRead(item: PreviouslyReadItem) {
  return {
    book: {
      id: item.book.id,
      title: item.book.title,
      subtitle: item.book.subtitle,
      description: item.book.description,
      pages: item.book.pages,
      release_date: item.book.release_date,
      release_year: item.book.release_year,
      rating: item.book.rating,
      ratings_count: item.book.ratings_count,
      slug: item.book.slug,
      cover_url: item.book.image?.url || null,
      authors: item.book.contributions?.map((c) => c.author.name) || [],
      series:
        item.book.book_series
          ?.map((bs) => bs.series?.name)
          .filter(Boolean) || [],
    },
    user_book: {
      status: 'previously_read',
      rating: item.rating,
      date_added: item.date_added,
      first_read_date: item.first_read_date,
      last_read_date: item.last_read_date,
      read_count: item.read_count,
      owned: item.owned,
      starred: item.starred,
      review: item.review,
    },
  };
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const shouldRefresh = url.searchParams.has('refresh');

    const cacheKey = new Request(request.url, request);
    const cache = caches.default;

    if (!shouldRefresh) {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    try {
      const [currentlyReadingData, previouslyReadData] =
        await Promise.all([
          fetchHardcover(env.HARDCOVER_API_KEY, CURRENTLY_READING_QUERY),
          fetchHardcover(env.HARDCOVER_API_KEY, PREVIOUSLY_READ_QUERY),
        ]);

      if (!currentlyReadingData?.me?.[0]) {
        throw new Error('API returned no user data - check your API token');
      }

      const me = currentlyReadingData.me[0];
      const previouslyReadMe = previouslyReadData?.me?.[0];

      const responseData = {
        user: {
          id: me.id,
          username: me.username,
        },
        currently_reading: (me.user_books || []).map(
          mapCurrentlyReading
        ),
        previously_read: (previouslyReadMe?.user_books || []).map(
          mapPreviouslyRead
        ),
      };

      const response = new Response(JSON.stringify(responseData, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`,
        },
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
