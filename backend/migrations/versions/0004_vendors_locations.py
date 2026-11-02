"""Add vendor catalogue review audit and latest spatial fix

Revision ID: 0004_vendors_locations
Revises: 0003_mail_tokens
"""

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography


revision = '0004_vendors_locations'
down_revision = '0003_mail_tokens'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create parents before references; this migration is independent of live ORM classes.
    op.create_table('product_categories',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('slug', sa.String(length=64), nullable=False),
    sa.Column('name_en', sa.String(length=100), nullable=False),
    sa.Column('name_ta', sa.String(length=100), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('slug')
    )
    op.create_table('admin_audit_records',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('actor_user_id', sa.Uuid(), nullable=False),
    sa.Column('target_id', sa.Uuid(), nullable=False),
    sa.Column('action', sa.String(length=64), nullable=False),
    sa.Column('reason', sa.String(length=500), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('vendor_profiles',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('display_name', sa.String(length=100), nullable=False),
    sa.Column('description', sa.String(length=1000), nullable=False),
    sa.Column('verification_status', sa.String(length=16), nullable=False),
    sa.Column('is_available', sa.Boolean(), nullable=False),
    sa.Column('location_sharing_enabled', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("NOT is_available OR (verification_status='VERIFIED' AND location_sharing_enabled)", name='ck_vendor_online_consent'),
    sa.CheckConstraint("verification_status IN ('PENDING','VERIFIED','REJECTED','SUSPENDED')", name='ck_vendor_verification'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_table('vendor_categories',
    sa.Column('vendor_id', sa.Uuid(), nullable=False),
    sa.Column('category_id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['product_categories.id'], ),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendor_profiles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('vendor_id', 'category_id')
    )
    op.create_table('vendor_locations',
    sa.Column('vendor_id', sa.Uuid(), nullable=False),
    sa.Column('position', Geography('POINT', srid=4326, spatial_index=False), nullable=False),
    sa.Column('accuracy_m', sa.Float(), nullable=False),
    sa.Column('captured_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('accuracy_m >= 0 AND accuracy_m <= 100', name='ck_location_accuracy'),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendor_profiles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('vendor_id')
    )
    op.create_index('ix_vendor_position', 'vendor_locations', ['position'], unique=False, postgresql_using='gist')
    op.create_table('vendor_verifications',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('vendor_id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('evidence_note', sa.String(length=1000), nullable=False),
    sa.Column('decision_reason', sa.String(length=500), nullable=True),
    sa.Column('reviewed_by', sa.Uuid(), nullable=True),
    sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("status IN ('PENDING','VERIFIED','REJECTED')", name='ck_review_status'),
    sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendor_profiles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_review_status', 'vendor_verifications', ['status', 'submitted_at'], unique=False)
    op.create_index('uq_pending_review', 'vendor_verifications', ['vendor_id'], unique=True, postgresql_where=sa.text("status='PENDING'"))


def downgrade() -> None:
    # Drop dependent records first; never remove the PostGIS extension itself.
    op.drop_index('uq_pending_review', table_name='vendor_verifications', postgresql_where=sa.text("status='PENDING'"))
    op.drop_index('ix_review_status', table_name='vendor_verifications')
    op.drop_table('vendor_verifications')
    op.drop_index('ix_vendor_position', table_name='vendor_locations', postgresql_using='gist')
    op.drop_table('vendor_locations')
    op.drop_table('vendor_categories')
    op.drop_table('vendor_profiles')
    op.drop_table('admin_audit_records')
    op.drop_table('product_categories')
