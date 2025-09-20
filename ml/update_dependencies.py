import subprocess
import sys

def main():
    """
    This script updates the Python dependencies in requirements.txt to their latest versions.
    """
    try:
        # Upgrade pip
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "pip"])

        # Install dependencies from requirements.txt
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

        # Get a list of installed packages
        installed_packages = subprocess.check_output([sys.executable, "-m", "pip", "freeze"]).decode("utf-8").split("\n")
        packages = [pkg.split("==")[0] for pkg in installed_packages if pkg]

        # Upgrade all packages
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade"] + packages)

        # Save the updated dependencies to requirements.txt
        with open("requirements.txt", "w") as f:
            subprocess.run([sys.executable, "-m", "pip", "freeze"], stdout=f)

        print("Successfully updated requirements.txt")

    except subprocess.CalledProcessError as e:
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
