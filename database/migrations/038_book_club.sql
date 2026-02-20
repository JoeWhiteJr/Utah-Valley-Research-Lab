-- Book club books (for tracking books in the club)
CREATE TABLE book_club_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'current', 'past')),
    meet_date DATE,
    audio_path TEXT,
    notes TEXT,
    summary TEXT,
    transcript TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES users(id)
);

CREATE INDEX idx_book_club_books_status ON book_club_books(status) WHERE deleted_at IS NULL;

-- Reuse the existing updated_at trigger function
CREATE TRIGGER update_book_club_books_updated_at
    BEFORE UPDATE ON book_club_books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Book club votes (one vote per member, not per book)
CREATE TABLE book_club_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES book_club_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_book_club_votes_book ON book_club_votes(book_id);
