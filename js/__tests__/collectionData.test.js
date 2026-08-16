import { collectionTopics } from '../product/collectionData';

describe('native intelligence collection normalization', () => {
  test.each([
    [{ topic_list: { topics: [{ id: 1 }] } }, [{ id: 1 }]],
    [{ topics: [{ id: 2 }] }, [{ id: 2 }]],
    [{ topic_list: { topics: null } }, []],
    [{}, []],
  ])('normalizes supported tag/category payloads', (payload, expected) => {
    expect(collectionTopics(payload)).toEqual(expected);
  });
});
