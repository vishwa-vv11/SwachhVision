from sqlalchemy import TypeDecorator, String, Text
from geoalchemy2 import Geometry

class SpatialPoint(TypeDecorator):
    """
    Geospatial Point Type that uses PostGIS Geometry('POINT', srid=4326) on PostgreSQL
    and String representation on other databases (e.g. SQLite).
    """
    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(Geometry(geometry_type='POINT', srid=4326))
        else:
            return dialect.type_descriptor(String(100))

class SpatialPolygon(TypeDecorator):
    """
    Geospatial Polygon Type that uses PostGIS Geometry('POLYGON', srid=4326) on PostgreSQL
    and Text representation on other databases (e.g. SQLite).
    """
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(Geometry(geometry_type='POLYGON', srid=4326))
        else:
            return dialect.type_descriptor(Text)
