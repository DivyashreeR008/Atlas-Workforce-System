from setuptools import setup, find_packages

setup(
    name="atlas_observability",
    version="0.1.0",
    packages=["atlas_observability"],
    install_requires=[
        "prometheus-client>=0.19.0",
        "fastapi>=0.104.0",
        "starlette>=0.27.0",
    ],
    python_requires=">=3.9",
)
