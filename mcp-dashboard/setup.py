#!/usr/bin/env python3
"""
Setup script for MCP Dashboard GUI
"""

from setuptools import setup, find_packages
import os
from pathlib import Path

# Read the contents of README file
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text(encoding='utf-8')

# Read requirements from requirements.txt
def read_requirements():
    requirements_path = this_directory / "requirements.txt"
    if requirements_path.exists():
        with open(requirements_path, 'r', encoding='utf-8') as f:
            return [line.strip() for line in f if line.strip() and not line.startswith('#')]
    return []

# Read version from __init__.py
def read_version():
    init_path = this_directory / "__init__.py"
    if init_path.exists():
        with open(init_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('__version__'):
                    return line.split('=')[1].strip().strip('"').strip("'")
    return "1.0.0"

setup(
    name="mcp-dashboard-gui",
    version=read_version(),
    author="MCP Dashboard Team",
    author_email="dev@example.com",
    description="A desktop application for testing and monitoring MCP Gateway microservices",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/example/mcp-dashboard-gui",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Testing",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
        "Environment :: X11 Applications",
        "Environment :: Win32 (MS Windows)",
        "Environment :: MacOS X",
    ],
    python_requires=">=3.8",
    install_requires=read_requirements(),
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "flake8>=6.0.0",
            "mypy>=1.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "mcp-dashboard=app:cli_main",
            "mcp-dashboard-gui=app:cli_main",
        ],
    },
    include_package_data=True,
    package_data={
        "": ["*.md", "*.txt", "*.yml", "*.yaml"],
    },
    zip_safe=False,
    keywords="mcp dashboard gui testing microservices monitoring",
    project_urls={
        "Bug Reports": "https://github.com/example/mcp-dashboard-gui/issues",
        "Source": "https://github.com/example/mcp-dashboard-gui",
        "Documentation": "https://github.com/example/mcp-dashboard-gui/wiki",
    },
)