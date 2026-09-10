import { ensureCommandCenterFlag } from './partnerUtils';
import { collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
}));
jest.mock('./firebase', () => ({
  db: {},
}));

describe('ensureCommandCenterFlag', () => {
  it('updates members without flag', async () => {
    const mockDocs = [
      { data: () => ({ canAccessCommandCenter: undefined }), ref: { id: 'm1' } },
      { data: () => ({ canAccessCommandCenter: true }), ref: { id: 'm2' } },
    ];
    (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });
    (collection as jest.Mock).mockReturnValue('col');
    await ensureCommandCenterFlag('space123');
    expect(collection).toHaveBeenCalledWith(db, 'spaces/space123/members');
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith(mockDocs[0].ref, { canAccessCommandCenter: true });
  });
});
